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
                'Each subject has its own start and end date. Schedule sessions only within each subject\'s active date range.',
                'For every subject, topics MUST progress dynamically from beginner to advanced over its date range — not static or repeated.',
            ],
            steps: [
                'You MUST return a JSON object with a "schedule" key containing day names as keys',
                'Use ONLY these exact day keys: "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"',
                'Each day MUST contain a "sessions" array with session objects',
                'NEVER use numeric array keys like 0,1,2,3 for days',
                'Each session MUST be an object with subject, topic, duration_minutes (integer), focus_level, key_topics, sub_topics, and resources',
                'key_topics must be an array of 3-4 specific high-level concepts',
                'sub_topics must be an array of 5-8 granular, technical details or specific tasks for the session',
                'resources must be an array of 2-3 objects each containing title, url, and type (article, video, course, or tool)',
                'YOUTUBE URL RULE: ALWAYS use search format: https://www.youtube.com/results?search_query=[topic+tutorial]',
                'DOCUMENTATION RULE: ONLY link to trusted official documentation domains (e.g., https://react.dev/learn, https://developer.mozilla.org/). If you cannot find an official doc link, omit the documentation resource entirely rather than using a search URL.',
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
        $subjects = $data['subjects'] ?? [];
        $difficulties = json_encode($data['subject_difficulties'] ?? []);
        $hours = $data['daily_study_hours'] ?? 2;
        $goal = $data['study_goal'] ?? 'General Study Improvement';
        $sessionDurations = json_encode($data['subject_session_durations'] ?? []);
        $learningPaths = json_encode($data['learning_paths'] ?? []);
        $startDatesRaw = $data['subject_start_dates'] ?? [];
        $endDatesRaw = $data['subject_end_dates'] ?? [];

        $currentDay = $data['current_day'] ?? date('l');
        $currentDate = $data['current_date'] ?? date('Y-m-d');

        // Build per-subject summary with day counts for the AI
        $subjectSummaryLines = [];
        foreach ($subjects as $subject) {
            $start = $startDatesRaw[$subject] ?? $currentDate;
            $end = $endDatesRaw[$subject] ?? date('Y-m-d', strtotime('+30 days'));
            $days = max(1, (int) ceil((strtotime($end) - strtotime($start)) / 86400) + 1);
            $elapsed = max(0, (int) ceil((strtotime($currentDate) - strtotime($start)) / 86400));
            $remaining = max(0, $days - $elapsed);
            $progress = $days > 0 ? round(($elapsed / $days) * 100) : 0;
            $diff = $data['subject_difficulties'][$subject] ?? 2;
            $subjectSummaryLines[] = "  - {$subject}: {$start} → {$end} ({$days} total days, {$remaining} remaining, {$progress}% elapsed, difficulty={$diff})";
        }
        $subjectSummary = implode("\n", $subjectSummaryLines);
        $subjectsJson = json_encode($subjects);

        $prompt = <<<PROMPT
Generate a study schedule for a student with the following profile:
- Current Day/Date: {$currentDay}, {$currentDate}
- Subjects: {$subjectsJson}
- Subject Difficulties (1=Easy, 3=Hard): {$difficulties}
- Target Daily Hours: {$hours}
- Primary Study Goal: {$goal}
- Subject Session Duration Preferences (per subject min/max minutes): {$sessionDurations}

SPECIFIC LEARNING PATH CURRICULA (Day-by-Day Topics):
{$learningPaths}

PER-SUBJECT DATE RANGES AND PROGRESS:
{$subjectSummary}

SUBJECT DATE RANGE RULES:
- Each subject has its own start date and end date with a SPECIFIC number of days.
- ONLY schedule a subject on days that fall within its [start_date, end_date] range.
- If a subject's start date is in the future, do NOT schedule it this week.
- If a subject's end date has passed, do NOT schedule it (it is completed).
- Use the EXACT day count above to pace the topic progression for each subject.

TOPIC SELECTION & DURATION — THE DYNAMIC RULE:
- For EACH day, lookup the subject's curriculum provided above.
- Identify the correct topic based on the subject's current progress (day count from start_date to today).
- Every session MUST use the topic, key_topics, sub_topics, resources, AND EXACT duration_minutes from its corresponding day in the LEARNING PATH CURRICULUM.
- NEVER invent generic topics or custom durations if a curriculum is provided.

FOCUS CAPACITY CONSTRAINTS:
- Maximum sustainable high-focus time: 4 hours per day
- Maximum sustainable medium-focus time: 3 hours per day
- Maximum sustainable low-focus time: 2 hours per day
- IMPORTANT: Distribute study time across focus levels to prevent burnout

CRITICAL REQUIREMENTS:
1. You MUST return a JSON object with a "schedule" key containing day names as keys
2. Use ONLY these exact day keys: "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
3. Each day MUST contain a "sessions" array with session objects
4. NEVER use numeric array keys like 0,1,2,3 for days
5. Each session MUST have: subject (string), topic (string), duration_minutes (integer), focus_level (low|medium|high), key_topics (array of 3-4 concepts), sub_topics (array of 5-8 granular details), resources (array of 2-3 objects)
6. Each resource object MUST include title, url, and type (article|video|course|tool)
7. CRITICAL - YOUTUBE: Generate ONLY search result URLs: https://www.youtube.com/results?search_query=[topic+tutorial]
8. CRITICAL - DOCUMENTATION: Link ONLY to trusted official documentation domains (e.g., https://react.dev/learn, https://developer.mozilla.org/). If no official doc exists, leave that resource slot out instead of using a search URL.
9. Start scheduling from today ({$currentDay})
10. Do NOT wrap the schedule in a numeric array
11. Return ONLY the JSON object, no markdown formatting, no explanations
12. CRITICAL: Use EXACT subject names from the subjects list - DO NOT rename subjects

ENHANCED UX & QUALITY REQUIREMENTS:
- FOCUS VARIETY: Mix focus levels - high focus for challenging topics, medium for regular sessions, low for review
- NO REPEATS: Never repeat the same subject on the same day
- SESSION DURATION: Every session duration MUST match the `duration_minutes` specified in the subject's Learning Path curriculum for that specific day. DO NOT invent durations or round them.

Example format:
{
  "schedule": {
    "Monday": {
      "sessions": [
        {
          "subject": "Mathematics",
          "topic": "Introduction to Limits",
          "duration_minutes": 60,
          "focus_level": "high",
          "key_topics": ["What are limits", "Limit notation", "One-sided limits"],
          "sub_topics": ["Intuitive understanding", "Graphical approach", "Numerical approach", "Limit laws", "Practice problems"],
          "resources": [
            {"title": "Khan Academy Calculus", "url": "https://www.khanacademy.org/math/calculus-1", "type": "course"},
            {"title": "Limits Tutorial", "url": "https://www.youtube.com/results?search_query=limits+calculus+tutorial", "type": "video"}
          ]
        }
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
        $subjects = $data['subjects'] ?? [];
        $difficulties = json_encode($data['subject_difficulties'] ?? []);
        $startDatesRaw = $data['subject_start_dates'] ?? [];
        $endDatesRaw = $data['subject_end_dates'] ?? [];
        $hours = $data['daily_study_hours'] ?? 2;
        $sessionDurations = json_encode($data['subject_session_durations'] ?? []);
        $learningPaths = json_encode($data['learning_paths'] ?? []);
        $weekNumber = (int) ($data['week_number'] ?? 2);
        $prevWeekNum = $weekNumber - 1;
        $weekStartDate = $data['week_start_date'] ?? date('Y-m-d');
        $previousWeekSummary = $data['previous_week_schedule'] ?? '[]';
        $allCoveredTopics = json_encode($data['all_covered_topics'] ?? []);
        $completedTopics = json_encode($data['completed_topics'] ?? []);

        if (is_array($previousWeekSummary)) {
            $previousWeekSummary = json_encode($previousWeekSummary);
        }

        // Build per-subject summary with day counts
        $subjectSummaryLines = [];
        foreach ($subjects as $subject) {
            $start = $startDatesRaw[$subject] ?? $weekStartDate;
            $end = $endDatesRaw[$subject] ?? date('Y-m-d', strtotime('+30 days'));
            $days = max(1, (int) ceil((strtotime($end) - strtotime($start)) / 86400) + 1);
            $elapsed = max(0, (int) ceil((strtotime($weekStartDate) - strtotime($start)) / 86400));
            $remaining = max(0, $days - $elapsed);
            $progress = $days > 0 ? round(($elapsed / $days) * 100) : 0;
            $diff = $data['subject_difficulties'][$subject] ?? 2;
            $subjectSummaryLines[] = "  - {$subject}: {$start} → {$end} ({$days} total days, {$remaining} remaining, {$progress}% elapsed, difficulty={$diff})";
        }
        $subjectSummary = implode("\n", $subjectSummaryLines);
        $subjectsJson = json_encode($subjects);

        $prompt = <<<PROMPT
Generate the NEXT study schedule. This is WEEK {$weekNumber} (starting {$weekStartDate}).

- Subjects: {$subjectsJson}
- Subject Difficulties (1=Easy, 3=Hard): {$difficulties}
- Target Daily Hours: {$hours}
- Subject Session Duration Preferences (per subject min/max minutes): {$sessionDurations}
 
SPECIFIC LEARNING PATH CURRICULA (Day-by-Day Topics):
{$learningPaths}

PER-SUBJECT DATE RANGES AND PROGRESS:
{$subjectSummary}

PREVIOUS WEEK (Week {$prevWeekNum}) COVERED:
{$previousWeekSummary}

ALL TOPICS ALREADY COVERED (do NOT repeat these):
{$allCoveredTopics}

TOPICS THE STUDENT HAS COMPLETED:
{$completedTopics}

SUBJECT DATE RANGE RULES:
- ONLY schedule a subject if this week falls within its [start_date, end_date] range.
- If a subject's end date has passed, do NOT schedule it.

TOPIC PROGRESSION (BEGINNER → ADVANCED) — CRITICAL:
- Continue from where the previous week left off — do NOT repeat topics.
- Use the elapsed % above to determine topic difficulty level for each subject.
- Topics must be SPECIFIC to the actual subject — NEVER use generic names like "Introduction" or "Core Concepts".
- Each session must cover a NEW, progressively harder topic.

CRITICAL REQUIREMENTS:
1. You MUST return a JSON object with a "schedule" key containing day names as keys
2. Use ONLY these exact day keys: "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
3. Each day MUST contain a "sessions" array with session objects
4. NEVER use numeric array keys like 0,1,2,3 for days
5. Each session MUST have: subject (string), topic (string), duration_minutes (integer), focus_level (low|medium|high), key_topics (array of 3-4 concepts), sub_topics (array of 5-8 granular details), resources (array of 2-3 objects)
6. Each resource object MUST include title, url, and type (article|video|course|tool)
7. CRITICAL - YOUTUBE: ONLY generate search result URLs for YouTube.
8. CRITICAL - DOCS: Use search URLs for specific documentation: https://www.google.com/search?q=[topic]+official+documentation
9. Do NOT wrap the schedule in a numeric array
10. Return ONLY the JSON object, no markdown formatting, no explanations
11. CRITICAL: Use EXACT subject names from the subjects list - DO NOT rename subjects
12. DURATION RULE: Every session duration MUST match the `duration_minutes` specified in the subject's Learning Path curriculum for that day.

Example format:
{
  "schedule": {
    "Monday": {
      "sessions": [
        {"subject": "Mathematics", "topic": "Integration Techniques", "duration_minutes": 60, "focus_level": "high", "key_topics": [...], "sub_topics": [...], "resources": [...]}
      ]
    }
  },
  "strategy_summary": "Brief explanation of the new week's plan"
}
PROMPT;

        return $this->structured(new UserMessage($prompt));
    }
}
