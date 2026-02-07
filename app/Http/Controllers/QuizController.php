<?php

namespace App\Http\Controllers;

use App\Services\QuizService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use App\Models\Quiz;

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
}
