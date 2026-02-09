<?php

namespace App\AI\Neuron;

use App\AI\Neuron\Output\QuizOutput;
use App\AI\Providers\OpenRouter;
use NeuronAI\Agent;
use NeuronAI\Chat\Messages\UserMessage;
use NeuronAI\Providers\AIProviderInterface;
use NeuronAI\SystemPrompt;

class QuizAgent extends Agent
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
                'You are a quiz generator for a study planner app.',
                'Generate multiple-choice questions to test understanding of study topics.',
                'Questions should be clear, concise, and test real understanding.',
                'Each question must have exactly 4 options (A, B, C, D) with one correct answer.',
                'Include a brief explanation for the correct answer.',
            ],
        );
    }

    protected function getOutputClass(): string
    {
        return QuizOutput::class;
    }

    /**
     * Generate quiz questions for a given subject and topic.
     */
    public function generate(string $subject, string $topic, int $count = 4, string $difficulty = 'medium'): QuizOutput
    {
        $prompt = <<<PROMPT
Generate exactly {$count} multiple-choice questions about:
- Subject: {$subject}
- Topic: {$topic}
- Difficulty: {$difficulty}

IMPORTANT - Comprehensive Coverage:
- First, identify the key sub-topics/concepts within "{$topic}"
- Then distribute your {$count} questions across these key sub-topics
- Each question should cover a DIFFERENT aspect/sub-topic
- Do NOT ask multiple questions about the same concept
- Aim to test the breadth of the topic, not just one narrow area

For example, if the topic is "AWS IAM", cover areas like:
  Users/Groups, Roles, Policies, MFA, Access Keys (not just one of these)

Requirements:
1. Each question must have exactly 4 options labeled A, B, C, D
2. Only one option should be correct
3. Questions should test real understanding, not just memorization
4. Include a brief explanation for why the correct answer is right
5. Make wrong options plausible but clearly incorrect
6. Questions should be appropriate for a student studying this topic
7. Mix question types: conceptual, practical/scenario-based, and comparison
PROMPT;

        return $this->structured(new UserMessage($prompt));
    }
}
