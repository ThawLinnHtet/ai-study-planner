<?php

namespace App\AI\Neuron;

use App\AI\Neuron\Output\CurriculumOutput;
use App\AI\Providers\OpenRouter;
use NeuronAI\Agent;
use NeuronAI\Chat\Messages\UserMessage;
use NeuronAI\Providers\AIProviderInterface;
use NeuronAI\SystemPrompt;

class CurriculumAgent extends Agent
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
                'You are an expert curriculum designer. Create a progressive, subject-specific day-by-day study plan.',
                'Topics must flow logically from foundation to advanced application.',
                'IMPORTANT: Use REAL subject-specific terms (e.g. "Linear Algebra", "OOP: Classes"). No generic "Introduction" topics.',
            ],
            steps: [
                'Return ONLY a JSON object with a "curriculum" key containing numbered keys ("1", "2", ...)',
                'Each day MUST include: topic, level(beginner|intermediate|advanced), duration_minutes(int), focus_level(low|medium|high), key_topics(array 3-4), sub_topics(array 5-8), resources(array 2-3 objects)',
                'Resources MUST contain at least one "video" (YouTube) and one "article" (official documentation).',
                'Resources MUST contain title, url, type(article|video). Use direct documentation links (e.g. react.dev, docs.python.org, developer.mozilla.org) whenever possible.',
                'Only use YouTube or Google search links as a fallback if no official documentation exists for the topic.',
                'No markdown, no preamble, no explanations.',
            ]
        );
    }

    protected function getOutputClass(): string
    {
        return CurriculumOutput::class;
    }

    /**
     * Clean AI response by removing markdown formatting
     */
    protected function cleanResponse(string $response): string
    {
        $response = preg_replace('/^```json\s*/', '', $response);
        $response = preg_replace('/```\s*$/', '', $response);
        return trim($response);
    }

    /**
     * Override structured method to clean response before parsing
     */
    public function structured(\NeuronAI\Chat\Messages\Message|array $messages, ?string $class = null, int $maxRetries = 1): mixed
    {
        $provider = $this->provider();
        $response = $provider->chat(is_array($messages) ? $messages : [$messages]);
        $content = $this->cleanResponse($response->getContent());

        $data = json_decode($content, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new \Exception('Failed to parse AI curriculum response: ' . json_last_error_msg() . '. Content: ' . substr($content, 0, 500));
        }

        $outputClass = $class ?: $this->getOutputClass();
        $output = new $outputClass();

        foreach ($data as $key => $value) {
            if (property_exists($output, $key)) {
                $output->$key = $value;
            }
        }

        return $output;
    }

    /**
     * Generate the prompt string for a curriculum.
     */
    public function getPrompt(array $data): string
    {
        $subject = $data['subject'];
        $totalDays = $data['total_days'];
        $difficulty = $data['difficulty'] ?? 2;
        $dailyHours = $data['daily_hours'] ?? 2;
        $studyGoal = $data['study_goal'] ?? 'General Study Improvement';
        $targetDailyMinutesPerSubject = $data['target_daily_minutes'] ?? (int) (($dailyHours * 60) / max(1, $data['total_subjects'] ?? 1));

        $difficultyLabel = match ($difficulty) {
            1 => 'Easy (foundational)',
            3 => 'Hard (advanced/complex)',
            default => 'Medium (standard)',
        };

        // Calculate level distribution across days
        $beginnerDays = max(1, (int) round($totalDays * 0.3));
        $intermediateDays = max(1, (int) round($totalDays * 0.4));

        return <<<PROMPT
Generate a complete day-by-day study curriculum for the following:

- Subject: {$subject}
- Total Days: {$totalDays}
- Difficulty Level: {$difficultyLabel}
- Daily Study Capacity (Overall): {$dailyHours} hours
- Expected Daily Minutes for THIS Subject: {$targetDailyMinutesPerSubject} minutes
- Primary Study Goal: {$studyGoal}

LEVEL PROGRESSION (for {$totalDays} days):
- Days 1 to {$beginnerDays}: BEGINNER level — Foundations specific to {$subject}
- Days {$beginnerDays} to {$intermediateDays}: INTERMEDIATE level — Applied knowledge, hands-on practice
- Days {$intermediateDays} to {$totalDays}: ADVANCED level — Complex topics, real-world projects, mastery

DIFFICULTY ADAPTATION:
- Easy (1): Slower progression, more practice exercises, extra reinforcement
- Medium (2): Balanced progression with equal theory and practice
- Hard (3): Faster progression, more complex topics, challenging projects

CRITICAL — TOPIC NAMING:
- Every topic MUST be SPECIFIC to {$subject}. 
- NEVER use generic names like "Introduction", "Core Concepts", "Basic Principles", "Fundamentals".
- Instead use REAL topic names. For example:
  - Python: "Variables & Data Types", "Control Flow & Loops", "Functions & Scope", "OOP: Classes & Objects"
  - Mathematics: "Number Systems & Arithmetic", "Linear Equations", "Quadratic Functions", "Derivatives"
  - Physics: "Units & Measurement", "Newton's Laws of Motion", "Work & Energy", "Thermodynamics"
- Each day's topic must be UNIQUE and build on the previous day.

CRITICAL REQUIREMENTS:
1. Return a JSON object with a "curriculum" key containing numbered string keys ("1", "2", "3", ...)
2. Generate EXACTLY {$totalDays} days — no more, no less
3. Each day MUST have: topic (string), level (beginner|intermediate|advanced), duration_minutes (integer near {$targetDailyMinutesPerSubject}), focus_level (low|medium|high), key_topics (array of 3-4), sub_topics (array of 5-8), resources (array of 2-3 objects)
4. Each resource object MUST include title, url, and type (article|video|course|tool).
5. MANDATORY MIX: Each day MUST include at least one "video" (YouTube search) AND at least one "article" (Official documentation).
6. PREFER DIRECT LINKS: Prioritize official documentation (e.g. react.dev, docs.python.org). Avoid search-engine landing pages if a direct link to the topic exists.
7. YOUTUBE: Use search results ONLY as fallback: https://www.youtube.com/results?search_query=[subject+topic+tutorial]
7. Topics MUST build logically — each day should build on the previous
8. No topic should repeat across days
9. duration_minutes MUST average out to {$targetDailyMinutesPerSubject} minutes per day for this specific subject across the curriculum.
10. Return ONLY the JSON object, no markdown formatting

Example format (for React, 14 days):
{
  "curriculum": {
    "1": {
      "topic": "JSX and Component Basics",
      "level": "beginner",
      "duration_minutes": {$targetDailyMinutesPerSubject},
      "focus_level": "medium",
      "key_topics": ["JSX Syntax", "Creating Components", "Rendering Lists"],
      "sub_topics": ["Babel and JSX", "Functions vs Classes", "Props and children", "Conditional rendering", "Fragments", "Key attribute"],
      "resources": [
        {"title": "React: Describing the UI", "url": "https://react.dev/learn/describing-the-ui", "type": "article"},
        {"title": "React Components Tutorial", "url": "https://www.youtube.com/results?search_query=react+components+tutorial", "type": "video"}
      ]
    }
  },
  "strategy_summary": "This {$totalDays}-day curriculum for {$subject} progresses from beginner fundamentals through intermediate application to advanced mastery."
}
PROMPT;
    }

    /**
     * Generate a day-by-day curriculum for a subject.
     */
    public function generateCurriculum(array $data): CurriculumOutput
    {
        $prompt = $this->getPrompt($data);

        return $this->structured(new UserMessage($prompt));
    }
}
