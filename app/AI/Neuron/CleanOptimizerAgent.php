<?php

namespace App\AI\Neuron;

use App\AI\Neuron\Output\OptimizerOutput;
use App\AI\Providers\OpenRouter;
use NeuronAI\Agent;
use NeuronAI\Chat\Messages\UserMessage;
use NeuronAI\Providers\AIProviderInterface;
use NeuronAI\SystemPrompt;

class CleanOptimizerAgent extends Agent
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
                'Each session MUST be an object with subject, topic, duration_minutes, focus_level, key_topics, sub_topics, resources.',
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
            throw new \Exception('Failed to parse AI response: '.json_last_error_msg().'. Content: '.$content);
        }

        // Map to the output class
        $outputClass = $class ?: $this->getOutputClass();
        $output = new $outputClass;

        // Fill the output object
        foreach ($data as $key => $value) {
            if (property_exists($output, $key)) {
                $output->$key = $value;
            }
        }

        return $output;
    }

    /**
     * Refine and re-balance an existing study plan.
     */
    public function optimize(array $data): OptimizerOutput
    {
        $currentPlan = json_encode($data['current_plan'] ?? []);
        $analysis = json_encode($data['analysis_insights'] ?? []);
        $currentDay = $data['current_day'] ?? date('l');
        $currentDate = $data['current_date'] ?? date('Y-m-d');

        // User onboarding data to preserve
        $subjects = json_encode($data['user_subjects'] ?? []);
        $subjectStartDates = json_encode($data['subject_start_dates'] ?? []);
        $subjectEndDates = json_encode($data['subject_end_dates'] ?? []);
        $difficulties = json_encode($data['user_difficulties'] ?? []);
        $hours = $data['daily_study_hours'] ?? 2;
        $hasPerformanceData = $data['has_performance_data'] ?? false;

        $prompt = <<<PROMPT
Optimize this study plan based on performance analysis while preserving the user's original subjects and enhancing UX quality:

USER ONBOARDING DATA:
- Subjects: {$subjects}
- Subject Start Dates: {$subjectStartDates}
- Subject End Dates: {$subjectEndDates}
- Subject Difficulties: {$difficulties}
- Daily Study Hours: {$hours}

PERFORMANCE DATA AVAILABLE: {$hasPerformanceData}

CURRENT PLAN:
{$currentPlan}

PERFORMANCE ANALYSIS:
{$analysis}

Current Day/Date: {$currentDay}, {$currentDate}

CRITICAL REQUIREMENTS:
1. You MUST return a JSON object with an "optimized_schedule" key containing day names as keys
2. Use ONLY these exact day keys: "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
3. Each day MUST contain a "sessions" array with session objects
4. NEVER use numeric array keys like 0,1,2,3 for days
5. Each session MUST have: subject (string), topic (string), duration_minutes (integer), focus_level (low|medium|high)
6. Each session MUST include key_topics (3-4 items), sub_topics (5-8 items), and resources (2-3 items)
7. Each resource includes: title, url, type (article, video, course, textbook, or tool)
8. CRITICAL - YOUTUBE: ALWAYS generate search result URLs: https://www.youtube.com/results?search_query=[topic+tutorial]
9. CRITICAL - DOCUMENTATION: Link directly to the official documentation page for the subject/topic whenever possible (e.g., https://react.dev/learn). Use a Google search URL ONLY if no canonical official documentation URL exists.
10. IMPORTANT: Only use subjects from the user's onboarding data: {$subjects}
11. Do NOT introduce new subjects not in the user's original list
12. Do NOT wrap the schedule in a numeric array
13. Return ONLY the JSON object, no markdown formatting, no explanations

IMPORTANT - PERFORMANCE DATA HANDLING:
10. IF has_performance_data is false: DO NOT make major topic changes. Only adjust timing, focus levels, and session structure. Preserve beginner topics and difficulty level.
11. IF has_performance_data is true: Make performance-driven optimizations including topic adjustments, review sessions, and difficulty changes.

ENHANCED UX & QUALITY REQUIREMENTS:
12. DAILY TIME: Total daily study time MUST be exactly {$hours} hours (±15 minutes)
13. SUBJECT BALANCE: Distribute subjects evenly across the week (30-40% each for 2-3 subjects)
14. FOCUS VARIETY: Mix focus levels - high focus during peak hours, medium for regular sessions, low for review
15. NO REPEATS: Never repeat the same subject on the same day
16. TOPIC PROGRESSION: Topics should build logically from basic to advanced
17. SESSION DURATION: Keep sessions between 30-90 minutes, with longer sessions for difficult subjects
18. BREAKS: Build in natural break points between different subjects

OPTIMIZATION STRATEGY:
IF NO PERFORMANCE DATA:
- Preserve current topic difficulty and progression
- Only adjust session timing and focus levels
- Maintain beginner-friendly topic names and concepts
- Optimise for subject balance
- Add minimal structure improvements

IF PERFORMANCE DATA EXISTS:
- Analyze performance data to identify struggling subjects/topics
- Increase focus and time for weak areas while maintaining balance
- Add review sessions for topics with low quiz scores or missed sessions
- Adjust session timing based on when user performs best
- Maintain subject variety to prevent burnout
- Ensure topic progression continues logically

Example format:
{
  "optimized_schedule": {
    "Monday": {
      "sessions": [
        {
          "subject": "Mathematics",
          "topic": "Calculus",
          "duration_minutes": 60,
          "focus_level": "high",
          "key_topics": ["Limits and continuity", "Derivatives", "Integrals"],
          "resources": [
            {"title": "Khan Academy Calculus", "url": "https://www.khanacademy.org/math/calculus-1", "type": "course"},
            {"title": "Paul's Online Math Notes", "url": "https://tutorial.math.lamar.edu/Classes/CalcI/CalcI.aspx", "type": "article"}
          ]
        }
      ]
    }
  },
  "change_log": [
    "No performance data available - preserved current topic progression",
    "Adjusted session timing for better peak time alignment"
  ],
  "predicted_improvement": "Better timing and focus alignment should improve study efficiency"
}
PROMPT;

        return $this->structured(new UserMessage($prompt));
    }
}
