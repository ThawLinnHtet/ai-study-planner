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
                'Ensure all subjects are covered leading up to their respective exam dates.',
            ],
            steps: [
                'You MUST return a JSON object with a "schedule" key containing day names as keys',
                'Use ONLY these exact day keys: "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"',
                'Each day MUST contain a "sessions" array with session objects',
                'NEVER use numeric array keys like 0,1,2,3 for days',
                'Each session MUST be an object with subject, topic, duration_minutes (integer), and focus_level',
                'Do NOT wrap the schedule in a numeric array',
                'IMPORTANT: Do NOT schedule tasks for past days based on the provided Current Date. All tasks must be for Today or in the future.',
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
     * Generate an initial study plan based on user onboarding data.
     */
    public function createPlan(array $data): PlannerOutput
    {
        $subjects = json_encode($data['subjects'] ?? []);
        $examDates = json_encode($data['exam_dates'] ?? []);
        $difficulties = json_encode($data['subject_difficulties'] ?? []);
        $peak = $data['productivity_peak'] ?? 'morning';
        $hours = $data['daily_study_hours'] ?? 2;
        $goal = $data['study_goal'] ?? '';
        $sessionDurations = json_encode($data['subject_session_durations'] ?? []);

        $currentDay = $data['current_day'] ?? date('l');
        $currentDate = $data['current_date'] ?? date('Y-m-d');

        $prompt = <<<PROMPT
Generate a weekly study plan for a student with the following profile:
- Current Day/Date: {$currentDay}, {$currentDate}
- Subjects: {$subjects}
- Subject Difficulties (1=Easy, 3=Hard): {$difficulties}
- Exam Deadlines: {$examDates}
- Preferred Session Durations (min-max minutes per subject): {$sessionDurations}
- Target Daily Hours: {$hours}
- Peak Energy Time: {$peak}

FOCUS CAPACITY CONSTRAINTS:
- Maximum sustainable high-focus time: 4 hours per day
- Maximum sustainable medium-focus time: 3 hours per day
- Maximum sustainable low-focus time: 2 hours per day
- Total realistic focus capacity: 8 hours per day
- IMPORTANT: Distribute study time across focus levels to prevent burnout

CRITICAL REQUIREMENTS:
1. You MUST return a JSON object with a "schedule" key containing day names as keys
2. Use ONLY these exact day keys: "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
3. Each day MUST contain a "sessions" array with session objects
4. NEVER use numeric array keys like 0,1,2,3 for days
5. Each session MUST have: subject (string), topic (string), duration_minutes (integer), focus_level (low|medium|high)
6. Each session MUST include key_topics (array of 3-6 specific concepts) and resources (array of 2-4 helpful links)
7. Each resource MUST have: title (string), url (valid direct URL from trusted sites), type (article|video|course|tool)
8. Start scheduling from today ({$currentDay})
9. Do NOT wrap the schedule in a numeric array
10. Return ONLY the JSON object, no markdown formatting, no explanations

TRUSTED RESOURCE URLS (use direct links from these sites):
- YouTube channels: youtube.com/@channelname (e.g., @3blue1brown, @crashcourse, @khanacademy)
- YouTube playlists: youtube.com/playlist?list=PLAYLIST_ID
- Khan Academy sections: khanacademy.org/math, khanacademy.org/science/physics, etc.
- Wikipedia articles: en.wikipedia.org/wiki/Article_Name
- Official docs: docs.python.org, developer.mozilla.org, pandas.pydata.org/docs, matplotlib.org, etc.
- Educational platforms: coursera.org, freecodecamp.org, kaggle.com/learn
NEVER use search-style URLs like "site:domain.com" or "google.com/search". Always provide the actual direct URL to the content.
NEVER use broken/old URLs like specific MIT OCW course pages that may 404.

ENHANCED UX & QUALITY REQUIREMENTS:
9. DAILY TIME: Total daily study time MUST be exactly {$hours} hours (±15 minutes)
10. FOCUS DISTRIBUTION: Respect focus capacity limits - max 4h high, 3h medium, 2h low focus per day
11. PEAK ALIGNMENT: Schedule high-focus sessions during user's peak time ({$peak})
12. SUBJECT BALANCE: Distribute subjects evenly across available focus time
13. FOCUS VARIETY: Mix focus levels - high focus during peak time, medium for regular sessions, low for review
14. NO REPEATS: Never repeat the same subject on the same day
15. TOPIC PROGRESSION: Topics should build logically from basic to advanced
16. EXAM PREPARATION: Prioritize subjects with upcoming exams within 2 weeks

SESSION DURATION RULES:
- User's preferred session durations per subject: {$sessionDurations}
- FOR EACH SUBJECT: Check if user set min-max duration in the data above
- IF user set duration for subject: Use EXACTLY that min-max range (e.g., Math: 30-45min → use 30-45min for Math sessions)
- IF no duration set for subject: Use focus-based defaults (High=60min, Medium=45min, Low=30min)
- Maximum session length: 90 minutes (never exceed this)
- Minimum session length: 25 minutes (never go below this)
- IMPORTANT: Always respect user's min-max preferences exactly - don't randomly assign durations
- EXAMPLE: If user set "Math": {"min": 30, "max": 45}, then all Math sessions must be 30-45 minutes
17. STUDY GOAL ALIGNMENT: All topics and sessions should align with the study goal ({$goal}) - exam prep focuses on exam topics, skill building includes practical exercises
18. SESSION DURATION: If preferred session durations are provided for a subject, use those min-max ranges. Otherwise, keep sessions between 30-90 minutes, with longer sessions for difficult subjects
19. BREAKS: Build in natural break points between different subjects and focus levels

EXAM DATE HANDLING:
- Subjects WITH exam dates: Prioritize before exam, review during exam week, continue with new topics after exam
- Subjects WITHOUT exam dates: Continue normal progression indefinitely - never stop scheduling these subjects
- IMPORTANT: Even if one subject's exam passes, continue scheduling ALL other subjects normally
- Example: If AWS SAA exam passed, continue scheduling TypeScript, Python, Math, etc. with new topics
- NEVER stop generating schedules for subjects without exams just because another subject had an exam

FOCAPACITY-AWARE SCHEDULING STRATEGY:
- If {$hours} ≤ 4: Use high-focus sessions during peak time only
- If 4 < {$hours} ≤ 7: Mix high-focus (during peak) + medium-focus sessions
- If 7 < {$hours} ≤ 9: Add low-focus sessions for review and lighter topics
- If {$hours} > 9: Include mandatory break time and varied focus levels to prevent burnout

PEAK TIME OPTIMIZATION:
- Morning: Best for challenging concepts and new topics
- Afternoon: Ideal for complex exercises and deep work
- Evening: Good for review and practice sessions
- Night: Optimal for focused study and late-night work

SESSION ALLOCATION EXAMPLES:
For {$hours} hours with {$peak} peak time:
- High-focus: Allocate up to 4 hours during {$peak} for challenging topics
- Medium-focus: Allocate up to 3 hours for regular study and practice
- Low-focus: Allocate up to 2 hours for review and light topics
- Breaks: Include 15-minute breaks between 90-minute study blocks

Example format:
{
  "schedule": {
    "Monday": {
      "sessions": [
        {
          "subject": "Mathematics",
          "topic": "Calculus",
          "duration_minutes": 60,
          "focus_level": "high",
          "key_topics": ["Limits and continuity", "Derivatives", "Integrals", "Applications"],
          "resources": [
            {"title": "Khan Academy – Math", "url": "https://www.khanacademy.org/math", "type": "course"},
            {"title": "3Blue1Brown", "url": "https://www.youtube.com/@3blue1brown", "type": "video"}
          ]
        }
      ]
    },
    "Tuesday": {
      "sessions": [
        {
          "subject": "Physics",
          "topic": "Mechanics",
          "duration_minutes": 45,
          "focus_level": "medium",
          "key_topics": ["Newton's laws", "Free body diagrams", "Kinematics"],
          "resources": [
            {"title": "Khan Academy – Physics", "url": "https://www.khanacademy.org/science/physics", "type": "course"},
            {"title": "Walter Lewin Physics", "url": "https://www.youtube.com/playlist?list=PLyQSN7H0KRHBvSWMJ2eL8KX5p5Re6Z7bX", "type": "video"},
            {"title": "Physics Classroom", "url": "https://www.physicsclassroom.com/", "type": "article"}
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
        $subjects = json_encode($data['subjects'] ?? []);
        $examDates = json_encode($data['exam_dates'] ?? []);
        $difficulties = json_encode($data['subject_difficulties'] ?? []);
        $peak = $data['productivity_peak'] ?? 'morning';
        $hours = $data['daily_study_hours'] ?? 2;
        $sessionDurations = json_encode($data['subject_session_durations'] ?? []);
        $weekNumber = (int) ($data['week_number'] ?? 2);
        $prevWeekNum = $weekNumber - 1;
        $weekStartDate = $data['week_start_date'] ?? date('Y-m-d');
        $previousWeekSummary = $data['previous_week_schedule'] ?? '[]';
        $allCoveredTopics = $data['all_covered_topics'] ?? [];
        $completedTopics = $data['completed_topics'] ?? [];

        if (is_array($previousWeekSummary)) {
            $previousWeekSummary = json_encode($previousWeekSummary);
        }

        $coveredTopicsJson = json_encode($allCoveredTopics);
        $completedTopicsJson = json_encode($completedTopics);

        $prompt = <<<PROMPT
Generate the NEXT weekly study schedule. This is WEEK {$weekNumber} (starting {$weekStartDate}).

- Subjects: {$subjects}
- Subject Difficulties (1=Easy, 3=Hard): {$difficulties}
- Exam Deadlines: {$examDates}
- Preferred Session Durations (min-max minutes per subject): {$sessionDurations}
- Target Daily Hours: {$hours}
- Peak Energy Time: {$peak}

PREVIOUS WEEK (Week {$prevWeekNum}) COVERED:
{$previousWeekSummary}

ALL PREVIOUSLY SCHEDULED TOPICS (Weeks 1-{$prevWeekNum}):
{$coveredTopicsJson}

USER'S COMPLETED/PASSED TOPICS (verified by quiz):
{$completedTopicsJson}

⚠️ ANTI-REPETITION RULES (CRITICAL):
- You MUST NOT repeat any topic listed in "ALL PREVIOUSLY SCHEDULED TOPICS" above.
- Every topic this week MUST be NEW and DIFFERENT from all previous weeks.
- Topics must PROGRESS FORWARD in the curriculum. For example:
  * If Week 1 covered "Introduction to Calculus", Week 2 should cover "Derivatives" or "Limits in Depth", NOT "Introduction to Calculus" again.
  * If Week 2 covered "Derivatives", Week 3 should cover "Integration" or "Applications of Derivatives", NOT "Derivatives" again.
- For subjects where the user has COMPLETED topics (passed quiz), advance to the NEXT logical chapter.
- For subjects where the user has NOT completed topics, you may revisit them at a slightly higher level but with a DIFFERENT topic name and different key_topics.

TOPIC PROGRESSION STRATEGY:
- Week {$weekNumber} should naturally continue from where Week {$prevWeekNum} ended.
- Each subject should advance deeper into its curriculum.
- Use progressive topic names that clearly indicate advancement (e.g., "Calculus I: Limits" → "Calculus II: Derivatives" → "Calculus III: Integration").
- Include review sessions only if exam is within 7 days, and label them as "Review: [topic]" to distinguish from new content.

EXAM DATE HANDLING:
- Subjects WITH exam dates: Prioritize before exam, review during exam week, continue with new topics after exam
- Subjects WITHOUT exam dates: Continue normal progression indefinitely - never stop scheduling these subjects
- IMPORTANT: Even if one subject's exam passes, continue scheduling ALL other subjects normally
- Example: If AWS SAA exam passed, continue scheduling TypeScript, Python, Math, etc. with new topics
- NEVER stop generating schedules for subjects without exams just because another subject had an exam

SESSION DURATION RULES:
- User's preferred session durations per subject: {$sessionDurations}
- FOR EACH SUBJECT: Check if user set min-max duration in the data above
- IF user set duration for subject: Use EXACTLY that min-max range (e.g., Math: 30-45min → use 30-45min for Math sessions)
- IF no duration set for subject: Use focus-based defaults (High=60min, Medium focus=45min, Low focus=30min)
- Maximum session length: 90 minutes (never exceed this)
- Minimum session length: 25 minutes (never go below this)
- IMPORTANT: Always respect user's min-max preferences exactly - don't randomly assign durations
- EXAMPLE: If user set "Math": {"min": 30, "max": 45}, then all Math sessions must be 30-45 minutes

CRITICAL REQUIREMENTS:
1. You MUST return a JSON object with a "schedule" key containing day names as keys
2. Use ONLY these exact day keys: "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
3. Each day MUST contain a "sessions" array with session objects
4. NEVER use numeric array keys like 0,1,2,3 for days
5. Each session MUST have: subject (string), topic (string), duration_minutes (integer), focus_level (low|medium|high)
6. Each session MUST include key_topics (array of 3-6 specific concepts) and resources (array of 2-4 helpful links)
7. Each resource MUST have: title (string), url (valid direct URL), type (article|video|course|tool)
8. Do NOT wrap the schedule in a numeric array
9. ALL topics MUST be NEW — never repeat a previously scheduled topic
10. Return ONLY the JSON object, no markdown formatting, no explanations

TRUSTED RESOURCE URLS:
- YouTube channels/playlists: youtube.com/@channelname or youtube.com/playlist?list=ID
- Khan Academy sections: khanacademy.org/math, khanacademy.org/science/physics
- Wikipedia articles: en.wikipedia.org/wiki/Article_Name
- Official docs: docs.python.org, pandas.pydata.org, matplotlib.org, etc.
- Educational platforms: coursera.org, freecodecamp.org
NEVER use "site:" or search-style URLs. Always use direct content URLs.

Example format:
{
  "schedule": {
    "Monday": {
      "sessions": [
        {
          "subject": "Mathematics",
          "topic": "Advanced Calculus",
          "duration_minutes": 60,
          "focus_level": "high",
          "key_topics": ["Multivariable limits", "Gradient and Jacobian", "Taylor series"],
          "resources": [
            {"title": "Khan Academy – Math", "url": "https://www.khanacademy.org/math", "type": "course"},
            {"title": "3Blue1Brown", "url": "https://www.youtube.com/@3blue1brown", "type": "video"}
          ]
        }
      ]
    }
  },
  "strategy_summary": "Brief explanation of the new week's plan"
}
PROMPT;

        return $this->structured(new UserMessage($prompt));
    }
}
