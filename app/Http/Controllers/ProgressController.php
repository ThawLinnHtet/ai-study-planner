<?php

namespace App\Http\Controllers;

use App\Models\QuizResult;
use App\Services\UserProgressService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ProgressController extends Controller
{
    public function __construct(protected UserProgressService $progress)
    {
    }

    public function index(Request $request): Response
    {
        $user = $request->user();

        // Get quiz history
        $quizHistory = $user->quizResults()
            ->with('quiz')
            ->orderBy('taken_at', 'desc')
            ->get()
            ->map(fn (QuizResult $r) => [
                'id' => $r->id,
                'subject' => $r->meta['subject'] ?? '',
                'topic' => $r->meta['topic'] ?? '',
                'percentage' => (float) $r->percentage,
                'passed' => $r->percentage >= 70,
                'correct_count' => $r->correct_count,
                'incorrect_count' => $r->incorrect_count,
                'skipped_count' => $r->skipped_count,
                'total_questions' => $r->max_score,
                'taken_at' => $r->taken_at?->toISOString(),
                // Add review data
                'review' => $this->buildReviewData($r),
            ]);

        $totalQuizzes = $quizHistory->count();
        $passedQuizzes = $quizHistory->where('passed', true)->count();
        $averageScore = $totalQuizzes > 0 ? round($quizHistory->avg('percentage'), 1) : 0;

        // Subject breakdown
        $subjectBreakdown = $quizHistory
            ->groupBy('subject')
            ->map(fn ($items, $subject) => [
                'subject' => $subject,
                'total' => $items->count(),
                'passed' => $items->where('passed', true)->count(),
                'average' => round($items->avg('percentage'), 1),
            ])
            ->values();

        $quizStats = [
            'total' => $totalQuizzes,
            'passed' => $passedQuizzes,
            'failed' => $totalQuizzes - $passedQuizzes,
            'average_score' => $averageScore,
            'pass_rate' => $totalQuizzes > 0 ? round(($passedQuizzes / $totalQuizzes) * 100, 1) : 0,
            'subject_breakdown' => $subjectBreakdown,
        ];

        // Generate quiz trends data
        $quizTrends = [
            'score_trend' => $quizHistory
                ->take(30) // Last 30 quizzes
                ->map(fn ($quiz) => [
                    'date' => $quiz['taken_at'] ?? now()->toISOString(),
                    'score' => $quiz['percentage'],
                    'subject' => $quiz['subject'],
                    'topic' => $quiz['topic'],
                ])
                ->values(),
            'completion_trend' => $quizHistory
                ->groupBy(fn ($quiz) => substr($quiz['taken_at'] ?? now()->toISOString(), 0, 10)) // Group by date
                ->map(fn ($quizzes, $date) => [
                    'date' => $date,
                    'completed' => $quizzes->where('passed', true)->count(),
                    'attempted' => $quizzes->count(),
                ])
                ->values(),
            'subject_performance' => $subjectBreakdown
                ->map(fn ($subject) => [
                    'subject' => $subject['subject'],
                    'average_score' => $subject['average'],
                    'improvement_rate' => 0, // TODO: Calculate actual improvement rate
                    'trend' => 'stable', // TODO: Calculate actual trend
                ])
                ->values(),
        ];

        return Inertia::render('progress', [
            'progress' => $this->progress->getStats($user, 30),
            'quizHistory' => $quizHistory->take(20),
            'quizStats' => $quizStats,
            'quizTrends' => $quizTrends,
        ]);
    }

    /**
     * Build review data for a quiz result
     */
    private function buildReviewData(QuizResult $result): array
    {
        $quiz = $result->quiz;
        $questions = $quiz?->questions ?? [];

        // If no questions data available, return empty array
        if (empty($questions)) {
            return [];
        }

        return array_map(fn ($q, $i) => [
            'question' => $q['question'] ?? '',
            'options' => $q['options'] ?? [],
            'correct_answer' => $q['correct_answer'] ?? '',
            'explanation' => $q['explanation'] ?? '',
            'user_answer' => $result->answers[$i]['user_answer'] ?? null,
            'is_correct' => $result->answers[$i]['is_correct'] ?? false,
            'skipped' => $result->answers[$i]['skipped'] ?? false,
        ], $questions, array_keys($questions));
    }
}
