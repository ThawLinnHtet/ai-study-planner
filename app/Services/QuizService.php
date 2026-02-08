<?php

namespace App\Services;

use App\AI\Neuron\QuizAgent;
use App\Models\Quiz;
use App\Models\QuizResult;
use App\Models\User;

class QuizService
{
    protected const PASS_PERCENTAGE = 75;
    protected const QUESTIONS_PER_QUIZ = 4;

    /**
     * Generate a quiz for a study session topic.
     */
    public function generateForSession(User $user, string $subject, string $topic): Quiz
    {
        $agent = QuizAgent::make();
        $output = $agent->generate(
            subject: $subject,
            topic: $topic,
            count: self::QUESTIONS_PER_QUIZ,
            difficulty: 'medium',
        );

        $questions = array_map(fn ($q) => [
            'question' => $q->question,
            'options' => array_map(fn ($o) => [
                'label' => $o->label,
                'text' => $o->text,
            ], $q->options),
            'correct_answer' => $q->correct_answer,
            'explanation' => $q->explanation,
        ], $output->questions);

        $activePlanId = $user->studyPlans()->where('status', 'active')->value('id');

        return Quiz::create([
            'user_id' => $user->id,
            'study_plan_id' => $activePlanId,
            'title' => "{$subject}: {$topic}",
            'description' => "Quiz to validate understanding of {$topic}",
            'difficulty' => 'medium',
            'total_questions' => count($questions),
            'questions' => $questions,
            'settings' => [
                'subject' => $subject,
                'topic' => $topic,
                'pass_percentage' => self::PASS_PERCENTAGE,
            ],
        ]);
    }

    /**
     * Submit quiz answers and calculate results.
     */
    public function submitAnswers(User $user, Quiz $quiz, array $answers, ?int $studySessionId = null): QuizResult
    {
        $questions = $quiz->questions ?? [];
        $correctCount = 0;
        $incorrectCount = 0;
        $skippedCount = 0;
        $detailedAnswers = [];

        foreach ($questions as $index => $question) {
            $userAnswer = $answers[$index] ?? null;

            if ($userAnswer === null) {
                $skippedCount++;
                $detailedAnswers[] = [
                    'question_index' => $index,
                    'user_answer' => null,
                    'correct_answer' => $question['correct_answer'],
                    'is_correct' => false,
                    'skipped' => true,
                ];
            } elseif (strtoupper($userAnswer) === strtoupper($question['correct_answer'])) {
                $correctCount++;
                $detailedAnswers[] = [
                    'question_index' => $index,
                    'user_answer' => $userAnswer,
                    'correct_answer' => $question['correct_answer'],
                    'is_correct' => true,
                    'skipped' => false,
                ];
            } else {
                $incorrectCount++;
                $detailedAnswers[] = [
                    'question_index' => $index,
                    'user_answer' => $userAnswer,
                    'correct_answer' => $question['correct_answer'],
                    'is_correct' => false,
                    'skipped' => false,
                ];
            }
        }

        $totalQuestions = count($questions);
        $percentage = $totalQuestions > 0 ? round(($correctCount / $totalQuestions) * 100, 2) : 0;

        return QuizResult::create([
            'user_id' => $user->id,
            'quiz_id' => $quiz->id,
            'study_plan_id' => $quiz->study_plan_id,
            'study_session_id' => $studySessionId,
            'score' => $correctCount,
            'max_score' => $totalQuestions,
            'percentage' => $percentage,
            'correct_count' => $correctCount,
            'incorrect_count' => $incorrectCount,
            'skipped_count' => $skippedCount,
            'answers' => $detailedAnswers,
            'meta' => [
                'subject' => $quiz->settings['subject'] ?? '',
                'topic' => $quiz->settings['topic'] ?? '',
            ],
            'taken_at' => now(),
        ]);
    }

    /**
     * Check if a quiz result passes the threshold.
     */
    public function isPassed(QuizResult $result): bool
    {
        return $result->percentage >= self::PASS_PERCENTAGE;
    }

    /**
     * Get pass percentage threshold.
     */
    public function getPassPercentage(): int
    {
        return self::PASS_PERCENTAGE;
    }
}
