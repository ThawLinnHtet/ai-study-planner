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
                'Ensure the new plan respects original daily hour constraints.'
            ],
            steps: [
                'The optimized_schedule MUST use day names (Monday, Tuesday, etc.) as keys.',
                'Each session in the schedule MUST be an object, never a string.',
                'Maintain the exact structure of the original schedule while re-balancing topics.',
                'Duration for each session MUST be provided in minutes as "duration_minutes" (integer).',
                'IMPORTANT: Do NOT schedule tasks for past days based on the provided Current Date. All optimizations must apply to Today and the future.'
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

        $prompt = <<<PROMPT
Optimize this study plan starting from today ({$currentDay}, {$currentDate}):
- Current Plan: {$currentPlan}
- Performance Insights: {$insights}
- New Availability Constraints: {$newAvailability}

IMPORTANT: The new optimized schedule must begin with tasks for today ({$currentDay}).
PROMPT;

        return $this->structured(new UserMessage($prompt));
    }
}
