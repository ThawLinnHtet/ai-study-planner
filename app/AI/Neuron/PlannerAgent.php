<?php

namespace App\AI\Neuron;

use App\AI\Neuron\Output\PlannerOutput;
use App\AI\Providers\OpenRouter;
use NeuronAI\Agent;
use NeuronAI\Chat\Messages\UserMessage;
use NeuronAI\Providers\AIProviderInterface;
use NeuronAI\SystemPrompt;

class PlannerAgent extends Agent
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
                'You are an expert academic planner.',
                'Your goal is to generate a highly efficient study schedule.',
                'Prioritize harder subjects during the student\'s peak energy time.',
                'Ensure all subjects are covered leading up to their respective exam dates.'
            ],
            steps: [
                'Use ONLY the keys "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday" for the schedule.',
                'Do NOT wrap the schedule in a numeric array.',
                'Each session MUST be a structured object with subject, topic, duration, and focus_level.',
                'Never return sessions as plain strings.',
                'IMPORTANT: Do NOT schedule tasks for past days based on the provided Current Date. All tasks must be for Today or in the future.'
            ]
        );
    }

    protected function getOutputClass(): string
    {
        return PlannerOutput::class;
    }

    /**
     * Generate an initial study plan based on user onboarding data.
     */
    public function createPlan(array $data): PlannerOutput
    {
        $subjects = json_encode($data['subjects'] ?? []);
        $examDates = json_encode($data['exam_dates'] ?? []);
        $difficulties = json_encode($data['subject_difficulties'] ?? []);
        $peak = $data['productivity_peak'] ?? 'morning';
        $hours = $data['daily_study_hours'] ?? 2;
        $styles = json_encode($data['learning_style'] ?? []);

        $currentDay = $data['current_day'] ?? date('l');
        $currentDate = $data['current_date'] ?? date('Y-m-d');

        $prompt = <<<PROMPT
Generate a weekly study plan for a student with the following profile:
- Current Day/Date: {$currentDay}, {$currentDate}
- Subjects: {$subjects}
- Subject Difficulties (1=Easy, 3=Hard): {$difficulties}
- Exam Deadlines: {$examDates}
- Target Daily Hours: {$hours}
- Peak Energy Time: {$peak}
- Learning Preferences: {$styles}

IMPORTANT: Start the schedule logic from today ({$currentDay}).
PROMPT;

        return $this->structured(new UserMessage($prompt));
    }
}
