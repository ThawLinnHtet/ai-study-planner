<?php

namespace App\AI\Neuron;

use App\AI\Neuron\Output\OptimizerOutput;
use App\AI\Providers\OpenRouter;
use NeuronAI\Agent;
use NeuronAI\Chat\Messages\UserMessage;
use NeuronAI\Providers\AIProviderInterface;
use NeuronAI\SystemPrompt;

class OptimizerAgent extends Agent
{
    protected function provider(): AIProviderInterface
    {
        return new OpenRouter(
            key: config('services.openrouter.key'),
            model: config('services.openrouter.model', 'google/gemini-2.0-flash-001'),
        );
    }

    public function instructions(): string
    {
        return (string) new SystemPrompt(
            background: [
                'You are an advanced optimization engine for education.',
                'Re-balance study schedules for maximum efficiency.',
                'Ensure the new plan respects original daily hour constraints.',
            ],
            steps: [
                'The optimized_schedule MUST use day names (Monday, Tuesday, etc.) as keys.',
                'Each day MUST contain a "sessions" array with session objects.',
                'Each session MUST be an object with subject, topic, duration_minutes, focus_level.',
                'NEVER use numeric array keys like 0,1,2,3 for days.',
                'Maintain the same subjects and topics but reorganize for better learning.',
                'Duration for each session MUST be provided in minutes as "duration_minutes" (integer).',
                'IMPORTANT: Do NOT schedule tasks for past days. All optimizations must apply to Today and the future.',
                'Return ONLY the JSON object, no markdown formatting, no explanations.',
            ]
        );
    }

    protected function getOutputClass(): string
    {
        return OptimizerOutput::class;
    }

    /**
     * Refine and re-balance an existing study plan.
     */
    public function optimize(array $data): OptimizerOutput
    {
        $currentPlan = json_encode($data['current_plan'] ?? []);
        $insights = json_encode($data['analysis_insights'] ?? []);
        $newAvailability = json_encode($data['new_availability'] ?? null);
        $currentDay = $data['current_day'] ?? date('l');
        $currentDate = $data['current_date'] ?? date('Y-m-d');
        $goal = $data['study_goal'] ?? 'General Study Improvement';
        $difficulties = json_encode($data['user_difficulties'] ?? []);
        $sessionDurations = json_encode($data['subject_session_durations'] ?? []);
        $learningPaths = json_encode($data['learning_paths'] ?? []);
        $startDatesRaw = $data['subject_start_dates'] ?? [];
        $endDatesRaw = $data['subject_end_dates'] ?? [];

        // Build per-subject summary for dates
        $subjectSummaryLines = [];
        $subjects = $data['user_subjects'] ?? [];
        foreach ($subjects as $subject) {
            $start = $startDatesRaw[$subject] ?? $currentDate;
            $end = $endDatesRaw[$subject] ?? date('Y-m-d', strtotime('+30 days'));
            $subjectSummaryLines[] = "  - {$subject}: {$start} → {$end}";
        }
        $subjectSummary = implode("\n", $subjectSummaryLines);

        $prompt = <<<PROMPT
Optimize this study plan starting from today ({$currentDay}, {$currentDate}):
- Current Plan: {$currentPlan}
- Performance Insights: {$insights}
- Primary Study Goal: {$goal}
- Subject Difficulties (1=Easy, 3=Hard): {$difficulties}
- Custom Session Duration Preferences: {$sessionDurations}
- New Availability Constraints: {$newAvailability}

SPECIFIC LEARNING PATH CURRICULA (Day-by-Day Topics):
{$learningPaths}

SUBJECT DATE RANGES:
{$subjectSummary}

IMPORTANT:
1. The new optimized schedule must begin with tasks for today ({$currentDay}).
2. Respect the user's Primary Study Goal (e.g., if it's "foundation", prioritize basic concepts).
3. Every session MUST match the EXACT `duration_minutes` specified in the subject's Learning Path curriculum for that specific day. DO NOT invent or round durations.
4. ONLY schedule subjects within their specific [start_date, end_date] range as shown above.
PROMPT;

        return $this->structured(new UserMessage($prompt));
    }
}
