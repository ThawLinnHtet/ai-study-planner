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
        // Enhanced randomization with microseconds and multiple random sources
        $randomSeed = microtime(true) . '_' . rand(10000, 99999) . '_' . uniqid();
        $currentTimestamp = date('Y-m-d H:i:s.u');
        $randomContext = bin2hex(random_bytes(8));
        
        $prompt = <<<PROMPT
Generate exactly {$count} COMPLETELY UNIQUE multiple-choice questions about:
- Subject: {$subject}
- Topic: {$topic}
- Difficulty: {$difficulty}
- Unique Request ID: {$randomSeed}
- Context Hash: {$randomContext}
- Generated At: {$currentTimestamp}

CRITICAL - RANDOMIZATION & UNIQUENESS:
- This is request #{$randomSeed} - generate COMPLETELY DIFFERENT questions than any previous requests
- Use the context hash {$randomContext} to ensure uniqueness
- NEVER repeat questions from previous generations
- Vary question styles, scenarios, and approaches significantly
- If this topic has been tested before, explore DIFFERENT angles and aspects

CRITICAL - COMPREHENSIVE SUB-TOPIC COVERAGE:
Step 1: Break down "{$topic}" into ALL its key sub-topics/concepts
Step 2: List at least {$count} distinct sub-topics or aspects
Step 3: Generate ONE question per sub-topic (distribute evenly)
Step 4: Ensure NO two questions test the same concept or sub-topic

Example breakdown for "Linear Algebra":
  Sub-topics: Vectors, Matrices, Determinants, Eigenvalues, Linear Transformations, 
  Vector Spaces, Orthogonality, Matrix Operations, Systems of Equations, Applications
  → Generate 1 question from EACH sub-topic (not multiple from one)

Example breakdown for "AWS IAM":
  Sub-topics: Users/Groups, Roles, Policies, MFA, Access Keys, Permissions, 
  Identity Federation, Service Control Policies, Resource-based Policies, Best Practices
  → Cover the FULL breadth, not just 2-3 areas

QUESTION VARIETY REQUIREMENTS:
1. Mix difficulty within {$difficulty} level (some easier, some harder)
2. Vary question formats:
   - Conceptual understanding (30%)
   - Practical/scenario-based (40%)
   - Comparison/analysis (20%)
   - Application/problem-solving (10%)
3. Use different question stems: "What", "How", "Why", "Which", "When", "Compare"
4. Vary scenario contexts (real-world, theoretical, troubleshooting, design)

TECHNICAL REQUIREMENTS:
1. Each question must have exactly 4 options labeled A, B, C, D
2. Only ONE option should be correct
3. Wrong options must be plausible but clearly incorrect
4. Include a brief, clear explanation for the correct answer
5. Questions should test understanding, not just memorization
6. Appropriate for a student studying this topic at {$difficulty} level

AVOID:
- Repetitive question patterns
- Similar scenarios across questions
- Testing the same concept multiple times
- Overly narrow focus on one sub-topic
- Generic or trivial questions
PROMPT;

        return $this->structured(new UserMessage($prompt));
    }
}
