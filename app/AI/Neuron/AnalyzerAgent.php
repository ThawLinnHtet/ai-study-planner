<?php

namespace App\AI\Neuron;

use App\AI\Neuron\Output\AnalyzerOutput;
use App\AI\Providers\OpenRouter;
use NeuronAI\Agent;
use NeuronAI\Chat\Messages\UserMessage;
use NeuronAI\Providers\AIProviderInterface;
use NeuronAI\SystemPrompt;

class AnalyzerAgent extends Agent
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
                'You are a performance psychologist and academic analyst.',
                'Identify patterns, weaknesses, and strengths in study behavior.',
                'Provide clear insights and subject mastery scores.'
            ],
        );
    }

    protected function getOutputClass(): string
    {
        return AnalyzerOutput::class;
    }

    /**
     * Analyze study performance and identify gaps.
     */
    public function analyze(array $data): AnalyzerOutput
    {
        $sessions = json_encode($data['study_sessions'] ?? []);
        $quizResults = json_encode($data['quiz_results'] ?? []);
        $currentPlan = json_encode($data['current_plan'] ?? []);

        $prompt = <<<PROMPT
Analyze the following study data:
- Recent Sessions: {$sessions}
- Quiz Results: {$quizResults}
- Current Active Plan: {$currentPlan}
PROMPT;

        return $this->structured(new UserMessage($prompt));
    }
}
