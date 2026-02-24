<?php

namespace App\Services;

use App\AI\Neuron\QuizAgent;
use App\Models\Quiz;
use App\Models\QuizResult;
use App\Models\User;

class QuizService
{
    protected const PASS_PERCENTAGE = 70;
    protected const QUESTIONS_PER_QUIZ = 10;

    /**
     * Generate a quiz for a study session topic.
     */
    public function generateForSession(User $user, string $subject, string $topic, bool $isRetry = false): Quiz
    {
        $agent = QuizAgent::make();
        
        // Add retry context to topic to ensure different questions
        $topicWithContext = $topic;
        if ($isRetry) {
            // Get previous quiz count for this topic to ensure variety
            $previousCount = Quiz::where('user_id', $user->id)
                ->where('settings->subject', $subject)
                ->where('settings->topic', $topic)
                ->count();
            
            $topicWithContext = "{$topic} (Retry #{$previousCount} - Focus on different aspects)";
        }
        
        $output = $agent->generate(
            subject: $subject,
            topic: $topicWithContext,
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
            'description' => $isRetry 
                ? "Retry quiz covering different aspects of {$topic}"
                : "Quiz to validate understanding of {$topic}",
            'difficulty' => 'medium',
            'total_questions' => count($questions),
            'questions' => $questions,
            'settings' => [
                'subject' => $subject,
                'topic' => $topic,
                'pass_percentage' => self::PASS_PERCENTAGE,
                'is_retry' => $isRetry,
                'generated_at' => now()->toIso8601String(),
            ],
        ]);
    }

    /**
     * Generate a comprehensive quiz covering multiple topics for a study session.
     */
    public function generateForStudySession(User $user, string $subject, array $topics): Quiz
    {
        $questionsPerTopic = max(1, floor(self::QUESTIONS_PER_QUIZ / count($topics)));
        $allQuestions = [];

        foreach ($topics as $topic) {
            $agent = QuizAgent::make();
            $output = $agent->generate(
                subject: $subject,
                topic: $topic,
                count: $questionsPerTopic,
                difficulty: 'medium',
            );

            $topicQuestions = array_map(fn ($q) => [
                'question' => $q->question,
                'options' => array_map(fn ($o) => [
                    'label' => $o->label,
                    'text' => $o->text,
                ], $q->options),
                'correct_answer' => $q->correct_answer,
                'explanation' => $q->explanation,
                'topic' => $topic, // Track which topic each question belongs to
            ], $output->questions);

            $allQuestions = array_merge($allQuestions, $topicQuestions);
        }

        // Shuffle questions to mix topics
        shuffle($allQuestions);

        $activePlanId = $user->studyPlans()->where('status', 'active')->value('id');
        $topicsList = implode(', ', $topics);

        return Quiz::create([
            'user_id' => $user->id,
            'study_plan_id' => $activePlanId,
            'title' => "{$subject}: Study Session Quiz",
            'description' => "Comprehensive quiz covering: {$topicsList}",
            'difficulty' => 'medium',
            'total_questions' => count($allQuestions),
            'questions' => $allQuestions,
            'settings' => [
                'subject' => $subject,
                'topics' => $topics,
                'pass_percentage' => self::PASS_PERCENTAGE,
            ],
        ]);
    }

    /**
     * Submit quiz answers and calculate results.
     */
    public function submitAnswers(User $user, Quiz $quiz, array $answers, ?int $studySessionId = null, ?array $antiCheatData = null): QuizResult
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

        // Calculate duration from anti-cheat data
        $durationSeconds = null;
        if ($antiCheatData && isset($antiCheatData['total_time'])) {
            // Frontend sends total_time in seconds, not milliseconds
            $durationSeconds = (int) $antiCheatData['total_time'];
        }

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
            'duration_seconds' => $durationSeconds,
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
