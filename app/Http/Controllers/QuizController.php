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
     */
    public function generate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'subject' => ['required', 'string'],
            'topic' => ['required', 'string'],
        ]);

        $user = $request->user();

        try {
            $quiz = $this->quizService->generateForSession(
                user: $user,
                subject: $validated['subject'],
                topic: $validated['topic'],
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
            report($e);

            return response()->json([
                'error' => 'Failed to generate quiz. Please try again.',
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
        ]);

        $user = $request->user();
        $quiz = Quiz::where('id', $validated['quiz_id'])
            ->where('user_id', $user->id)
            ->firstOrFail();

        $result = $this->quizService->submitAnswers(
            user: $user,
            quiz: $quiz,
            answers: $validated['answers'],
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
                'passed' => $result->percentage >= 80,
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
            'passed' => $result->percentage >= 80,
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
            report($e);

            return response()->json([
                'error' => 'Failed to generate retake quiz. Please try again.',
            ], 500);
        }
    }
}
