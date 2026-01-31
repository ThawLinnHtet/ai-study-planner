<?php

namespace App\AI\Neuron;

use App\AI\Neuron\Output\PlannerOutput;
use App\AI\Providers\OpenRouter;
use NeuronAI\Agent;
use NeuronAI\Chat\Messages\UserMessage;
use NeuronAI\Providers\AIProviderInterface;
use NeuronAI\SystemPrompt;

class CleanPlannerAgent extends Agent
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
                'You MUST return a JSON object with a "schedule" key containing day names as keys',
                'Use ONLY these exact day keys: "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"',
                'Each day MUST contain a "sessions" array with session objects',
                'NEVER use numeric array keys like 0,1,2,3 for days',
                'Each session MUST be an object with subject, topic, duration_minutes (integer), and focus_level',
                'Do NOT wrap the schedule in a numeric array',
                'IMPORTANT: Do NOT schedule tasks for past days based on the provided Current Date. All tasks must be for Today or in the future.'
            ]
        );
    }

    protected function getOutputClass(): string
    {
        return PlannerOutput::class;
    }

    /**
     * Clean AI response by removing markdown formatting
     */
    protected function cleanResponse(string $response): string
    {
        // Remove ```json and ``` markdown wrappers
        $response = preg_replace('/^```json\s*/', '', $response);
        $response = preg_replace('/```\s*$/', '', $response);
        
        // Trim whitespace
        return trim($response);
    }

    /**
     * Override structured method to clean response before parsing
     */
    public function structured(\NeuronAI\Chat\Messages\Message|array $messages, ?string $class = null, int $maxRetries = 1): mixed
    {
        // Get the raw response first
        $provider = $this->provider();
        $response = $provider->chat(is_array($messages) ? $messages : [$messages]);
        $content = $this->cleanResponse($response->getContent());
        
        // Parse the cleaned JSON
        $data = json_decode($content, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new \Exception('Failed to parse AI response: ' . json_last_error_msg() . '. Content: ' . $content);
        }
        
        // Map to the output class
        $outputClass = $class ?: $this->getOutputClass();
        $output = new $outputClass();
        
        // Fill the output object
        foreach ($data as $key => $value) {
            if (property_exists($output, $key)) {
                $output->$key = $value;
            }
        }
        
        return $output;
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

CRITICAL REQUIREMENTS:
1. You MUST return a JSON object with a "schedule" key containing day names as keys
2. Use ONLY these exact day keys: "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
3. Each day MUST contain a "sessions" array with session objects
4. NEVER use numeric array keys like 0,1,2,3 for days
5. Each session MUST have: subject (string), topic (string), duration_minutes (integer), focus_level (low|medium|high)
6. Start scheduling from today ({$currentDay})
7. Do NOT wrap the schedule in a numeric array
8. Return ONLY the JSON object, no markdown formatting, no explanations

Example format:
{
  "schedule": {
    "Monday": {
      "sessions": [
        {"subject": "Mathematics", "topic": "Calculus", "duration_minutes": 60, "focus_level": "high"}
      ]
    },
    "Tuesday": {
      "sessions": [
        {"subject": "Physics", "topic": "Mechanics", "duration_minutes": 45, "focus_level": "medium"}
      ]
    }
  },
  "strategy_summary": "Brief explanation of the schedule"
}
PROMPT;

        return $this->structured(new UserMessage($prompt));
    }

    /**
     * Generate the next week's schedule (week 2, 3, ...) building on the previous week.
     */
    public function createNextWeekPlan(array $data): PlannerOutput
    {
        $subjects = json_encode($data['subjects'] ?? []);
        $examDates = json_encode($data['exam_dates'] ?? []);
        $difficulties = json_encode($data['subject_difficulties'] ?? []);
        $peak = $data['productivity_peak'] ?? 'morning';
        $hours = $data['daily_study_hours'] ?? 2;
        $styles = json_encode($data['learning_style'] ?? []);
        $weekNumber = (int) ($data['week_number'] ?? 2);
        $prevWeekNum = $weekNumber - 1;
        $weekStartDate = $data['week_start_date'] ?? date('Y-m-d');
        $previousWeekSummary = $data['previous_week_schedule'] ?? '[]';

        if (is_array($previousWeekSummary)) {
            $previousWeekSummary = json_encode($previousWeekSummary);
        }

        $prompt = <<<PROMPT
Generate the NEXT weekly study schedule. This is WEEK {$weekNumber} (starting {$weekStartDate}).

- Subjects: {$subjects}
- Subject Difficulties (1=Easy, 3=Hard): {$difficulties}
- Exam Deadlines: {$examDates}
- Target Daily Hours: {$hours}
- Peak Energy Time: {$peak}
- Learning Preferences: {$styles}

PREVIOUS WEEK (Week {$prevWeekNum}) COVERED:
{$previousWeekSummary}

CRITICAL REQUIREMENTS:
1. You MUST return a JSON object with a "schedule" key containing day names as keys
2. Use ONLY these exact day keys: "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
3. Each day MUST contain a "sessions" array with session objects
4. NEVER use numeric array keys like 0,1,2,3 for days
5. Each session MUST have: subject (string), topic (string), duration_minutes (integer), focus_level (low|medium|high)
6. Do NOT wrap the schedule in a numeric array
7. Generate NEW topics/chapters progressing from where the previous week left off
8. Return ONLY the JSON object, no markdown formatting, no explanations

Example format:
{
  "schedule": {
    "Monday": {
      "sessions": [
        {"subject": "Mathematics", "topic": "Advanced Calculus", "duration_minutes": 60, "focus_level": "high"}
      ]
    }
  },
  "strategy_summary": "Brief explanation of the new week's plan"
}
PROMPT;

        return $this->structured(new UserMessage($prompt));
    }
}
