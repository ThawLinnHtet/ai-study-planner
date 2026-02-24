<?php

namespace App\Http\Controllers;

use App\Services\QuizService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use App\Models\Quiz;
use App\Models\QuizResult;

class QuizController extends Controller
{
    public function __construct(
        protected QuizService $quizService,
    ) {
    }

    /**
     * Generate a quiz for a study session topic.
     * Returns cached quiz if one exists for the same subject+topic and hasn't been completed.
     */
    public function generate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'subject' => ['required', 'string'],
            'topic' => ['nullable', 'string'],
            'forceNew' => ['boolean'],
        ]);

        $user = $request->user();
        $forceNew = $validated['forceNew'] ?? false;



        // Debug logging
        $timezone = $user->timezone ?? config('app.timezone');
        \Log::info('Quiz generation request', [
            'user_id' => $user->id,
            'subject' => $validated['subject'],
            'topic' => $validated['topic'] ?? '',
            'forceNew' => $forceNew,
            'timestamp' => now($timezone)->toIso8601String()
        ]);

        // Check for existing cached quiz (not yet completed/passed) - only if not forcing new
        $existingQuiz = null;
        if (!$forceNew) {
            // More specific cache matching using exact title format
            $expectedTitle = $validated['subject'] . ': ' . ($validated['topic'] ?? 'General');
            
            $existingQuiz = Quiz::where('user_id', $user->id)
                ->where('title', $expectedTitle) // Exact match instead of LIKE
                ->where('created_at', '>=', now($timezone)->subHours(24))
                ->whereDoesntHave('results', function ($q) {
                    $q->where('percentage', '>=', 70); // Exclude passed quizzes
                })
                ->latest()
                ->first();
        }

        if ($existingQuiz) {
            \Log::info('Returning cached quiz', [
                'quiz_id' => $existingQuiz->id,
                'title' => $existingQuiz->title,
                'created_at' => $existingQuiz->created_at->toIso8601String(),
                'total_questions' => $existingQuiz->total_questions
            ]);

            $safeQuestions = array_map(fn ($q) => [
                'question' => $q['question'],
                'options' => $q['options'],
            ], $existingQuiz->questions ?? []);

            return response()->json([
                'quiz_id' => $existingQuiz->id,
                'title' => $existingQuiz->title,
                'total_questions' => $existingQuiz->total_questions,
                'questions' => $safeQuestions,
                'pass_percentage' => $this->quizService->getPassPercentage(),
                'cached' => true,
            ]);
        }

        try {
            \Log::info('Generating new quiz', [
                'subject' => $validated['subject'],
                'topic' => $validated['topic'] ?? '',
                'isRetry' => $forceNew
            ]);

            $quiz = $this->quizService->generateForSession(
                user: $user,
                subject: $validated['subject'],
                topic: $validated['topic'] ?? '',
                isRetry: $forceNew, // Pass forceNew as retry flag
            );

            \Log::info('New quiz generated successfully', [
                'quiz_id' => $quiz->id,
                'title' => $quiz->title,
                'total_questions' => $quiz->total_questions,
                'is_retry' => $quiz->settings['is_retry'] ?? false
            ]);

            // Strip correct answers before sending to frontend
            $safeQuestions = array_map(fn ($q) => [
                'question' => $q['question'],
                'options' => $q['options'],
            ], $quiz->questions ?? []);

            return response()->json([
                'quiz_id' => $quiz->id,
                'title' => $quiz->title,
                'total_questions' => $quiz->total_questions,
                'questions' => $safeQuestions,
                'pass_percentage' => $this->quizService->getPassPercentage(),
            ]);
        } catch (\Exception $e) {
            \Log::error('Quiz generation failed: ' . $e->getMessage(), [
                'user_id' => $user->id,
                'subject' => $validated['subject'],
                'topic' => $validated['topic'] ?? '',
                'forceNew' => $forceNew,
                'trace' => $e->getTraceAsString()
            ]);

            // Check for specific error types
            if (str_contains($e->getMessage(), '404') || str_contains($e->getMessage(), 'No endpoints found')) {
                return response()->json([
                    'error' => 'AI service temporarily unavailable. Please try again in a few moments.',
                ], 503);
            }

            if (str_contains($e->getMessage(), 'API key') || str_contains($e->getMessage(), 'authentication')) {
                return response()->json([
                    'error' => 'AI service configuration error. Please contact support.',
                ], 500);
            }

            return response()->json([
                'error' => 'Failed to generate quiz: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Submit quiz answers and get results.
     */
    public function submit(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'quiz_id' => ['required', 'integer', 'exists:quizzes,id'],
            'answers' => ['required', 'array'],
            'answers.*' => ['nullable', 'string', 'in:A,B,C,D'],
            'anti_cheat_data' => ['nullable', 'array'],
        ]);

        $user = $request->user();
        $quiz = Quiz::where('id', $validated['quiz_id'])
            ->where('user_id', $user->id)
            ->firstOrFail();

        $result = $this->quizService->submitAnswers(
            user: $user,
            quiz: $quiz,
            answers: $validated['answers'],
            antiCheatData: $validated['anti_cheat_data'] ?? null,
        );

        $passed = $this->quizService->isPassed($result);

        // Build response with explanations
        $questions = $quiz->questions ?? [];
        $reviewData = array_map(fn ($q, $i) => [
            'question' => $q['question'],
            'options' => $q['options'],
            'correct_answer' => $q['correct_answer'],
            'explanation' => $q['explanation'],
            'user_answer' => $validated['answers'][$i] ?? null,
            'is_correct' => $result->answers[$i]['is_correct'] ?? false,
        ], $questions, array_keys($questions));

        return response()->json([
            'result_id' => $result->id,
            'passed' => $passed,
            'percentage' => $result->percentage,
            'correct_count' => $result->correct_count,
            'incorrect_count' => $result->incorrect_count,
            'skipped_count' => $result->skipped_count,
            'duration_seconds' => $result->duration_seconds,
            'total_questions' => $quiz->total_questions,
            'pass_percentage' => $this->quizService->getPassPercentage(),
            'review' => $reviewData,
        ]);
    }

    /**
     * Get quiz history for the authenticated user.
     */
    public function history(Request $request): JsonResponse
    {
        $user = $request->user();

        $results = $user->quizResults()
            ->with('quiz')
            ->orderBy('taken_at', 'desc')
            ->get()
            ->map(fn (QuizResult $result) => [
                'id' => $result->id,
                'quiz_id' => $result->quiz_id,
                'title' => $result->quiz?->title ?? 'Unknown Quiz',
                'subject' => $result->meta['subject'] ?? '',
                'topic' => $result->meta['topic'] ?? '',
                'percentage' => $result->percentage,
                'passed' => $result->percentage >= 70,
                'correct_count' => $result->correct_count,
                'incorrect_count' => $result->incorrect_count,
                'skipped_count' => $result->skipped_count,
                'total_questions' => $result->max_score,
                'taken_at' => $result->taken_at?->toISOString(),
            ]);

        return response()->json([
            'results' => $results,
            'total' => $results->count(),
            'passed_count' => $results->where('passed', true)->count(),
            'failed_count' => $results->where('passed', false)->count(),
        ]);
    }

    /**
     * Get detailed review of a specific quiz result.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        $result = $user->quizResults()
            ->with('quiz')
            ->where('id', $id)
            ->firstOrFail();

        $quiz = $result->quiz;
        $questions = $quiz?->questions ?? [];

        $reviewData = array_map(fn ($q, $i) => [
            'question' => $q['question'],
            'options' => $q['options'],
            'correct_answer' => $q['correct_answer'],
            'explanation' => $q['explanation'],
            'user_answer' => $result->answers[$i]['user_answer'] ?? null,
            'is_correct' => $result->answers[$i]['is_correct'] ?? false,
            'skipped' => $result->answers[$i]['skipped'] ?? false,
        ], $questions, array_keys($questions));

        return response()->json([
            'id' => $result->id,
            'title' => $quiz?->title ?? 'Unknown Quiz',
            'subject' => $result->meta['subject'] ?? '',
            'topic' => $result->meta['topic'] ?? '',
            'percentage' => $result->percentage,
            'passed' => $result->percentage >= 70,
            'correct_count' => $result->correct_count,
            'incorrect_count' => $result->incorrect_count,
            'skipped_count' => $result->skipped_count,
            'total_questions' => $result->max_score,
            'taken_at' => $result->taken_at?->toISOString(),
            'review' => $reviewData,
        ]);
    }

    /**
     * Retake a quiz for the same topic.
     */
    public function retake(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        // Get the previous result to extract topic info
        $result = $user->quizResults()
            ->where('id', $id)
            ->firstOrFail();

        $subject = $result->meta['subject'] ?? '';
        $topic = $result->meta['topic'] ?? '';

        if (empty($subject) || empty($topic)) {
            return response()->json([
                'error' => 'Cannot retake quiz: topic information missing.',
            ], 400);
        }

        // Generate a new quiz for the same topic
        try {
            $quiz = $this->quizService->generateForSession(
                user: $user,
                subject: $subject,
                topic: $topic,
                isRetry: true, // Always treat retake as retry for fresh questions
            );

            // Strip correct answers before sending to frontend
            $safeQuestions = array_map(fn ($q) => [
                'question' => $q['question'],
                'options' => $q['options'],
            ], $quiz->questions ?? []);

            return response()->json([
                'quiz_id' => $quiz->id,
                'title' => $quiz->title,
                'total_questions' => $quiz->total_questions,
                'questions' => $safeQuestions,
                'pass_percentage' => $this->quizService->getPassPercentage(),
            ]);
        } catch (\Throwable $e) {
            \Log::error('Quiz retake failed: ' . $e->getMessage(), [
                'user_id' => $user->id,
                'result_id' => $id,
                'subject' => $subject,
                'topic' => $topic,
                'trace' => $e->getTraceAsString()
            ]);

            // Check for specific error types
            if (str_contains($e->getMessage(), '404') || str_contains($e->getMessage(), 'No endpoints found')) {
                return response()->json([
                    'error' => 'AI service temporarily unavailable. Please try again in a few moments.',
                ], 503);
            }

            if (str_contains($e->getMessage(), 'API key') || str_contains($e->getMessage(), 'authentication')) {
                return response()->json([
                    'error' => 'AI service configuration error. Please contact support.',
                ], 500);
            }

            return response()->json([
                'error' => 'Failed to generate retake quiz: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Abandon a quiz (user left mid-session).
     * Deletes the quiz so the next generate call produces fresh random questions.
     */
    public function abandon(Request $request, int $quizId): JsonResponse
    {
        $user = $request->user();

        $quiz = Quiz::where('id', $quizId)
            ->where('user_id', $user->id)
            ->first();

        if (!$quiz) {
            return response()->json(['error' => 'Quiz not found.'], 404);
        }

        // Only delete if the quiz has no passing result — protect completed sessions
        $hasPassed = $quiz->results()->where('percentage', '>=', 70)->exists();
        if ($hasPassed) {
            return response()->json(['skipped' => true, 'reason' => 'Quiz already passed, keeping it.']);
        }

        $quiz->delete();

        return response()->json(['success' => true]);
    }


}
