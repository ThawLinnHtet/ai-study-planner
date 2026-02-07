<?php

namespace App\Services;

use App\AI\Neuron\NeuronService;
use App\Models\StudyPlan;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class StudyPlanService
{
    protected NeuronService $neuron;

    public function __construct(NeuronService $neuron)
    {
        $this->neuron = $neuron;
    }

    /**
     * Generate the initial study plan for a user after onboarding.
     */
    public function generateInitialPlan(User $user): StudyPlan
    {
        $data = [
            'subjects' => $user->subjects,
            'exam_dates' => $user->exam_dates,
            'subject_difficulties' => $user->subject_difficulties,
            'subject_session_durations' => $user->subject_session_durations ?? [],
            'daily_study_hours' => $user->daily_study_hours,
            'productivity_peak' => $user->productivity_peak,
            'study_goal' => $user->study_goal,
            'current_day' => Carbon::today()->format('l'),
            'current_date' => Carbon::today()->toDateString(),
        ];

        return $this->generatePlanWithData($user, $data);
    }

    /**
     * Generate a study plan with specific data (for settings updates).
     */
    public function generatePlanWithData(User $user, array $data): StudyPlan
    {
        // Ensure fresh data is passed to AI
        $planData = array_merge($data, [
            'current_day' => Carbon::today()->format('l'),
            'current_date' => Carbon::today()->toDateString(),
        ]);

        $output = $this->neuron->planner()->createPlan($planData);

        return DB::transaction(function () use ($user, $output, $planData) {
            // Deactivate any existing active plans
            $user->studyPlans()->where('status', 'active')->update(['status' => 'archived']);

            $startsOn = Carbon::today();
            $endsOn = $this->resolvePlanEndDate($planData['exam_dates'] ?? [], $startsOn);

            $normalized = $this->normalizeGeneratedPlan((array) $output);
            $normalized['weeks'] = [
                [
                    'week_start' => $startsOn->toDateString(),
                    'schedule' => $normalized['schedule'],
                ],
            ];

            return StudyPlan::create([
                'user_id' => $user->id,
                'title' => 'Updated Study Plan',
                'goal' => $planData['study_goal'] ?? $user->study_goal,
                'starts_on' => $startsOn,
                'ends_on' => $endsOn,
                'target_hours_per_week' => ($planData['daily_study_hours'] ?? $user->daily_study_hours) * 7,
                'status' => 'active',
                'preferences' => [
                    'productivity_peak' => $planData['productivity_peak'] ?? $user->productivity_peak,
                    'learning_style' => $planData['learning_style'] ?? $user->learning_style,
                ],
                'generated_plan' => $normalized,
                'prevent_rebalance_until' => Carbon::now()->addHours(24), // Prevent AI re-balance for 24 hours
            ]);
        });
    }

    /**
     * Get the plan with generated_plan.schedule set to the current week's schedule.
     * Generates the next week's schedule when the user has moved into a new week.
     */
    public function getPlanForCurrentWeek(StudyPlan $plan): array
    {
        $plan->refresh();
        $gp = $plan->generated_plan ?? [];
        if (! is_array($gp)) {
            $gp = [];
        }

        $startsOn = Carbon::parse($plan->starts_on)->startOfDay();
        $today = Carbon::today()->startOfDay();
        $daysSinceStart = $startsOn->diffInDays($today, false);
        $weekIndex = (int) floor($daysSinceStart / 7);
        if ($weekIndex < 0) {
            $weekIndex = 0;
        }

        // Ensure weeks array exists (migrate from legacy single schedule)
        $weeks = $gp['weeks'] ?? [];
        if (! is_array($weeks)) {
            $weeks = [];
        }
        if (empty($weeks) && ! empty($gp['schedule'])) {
            $weeks = [
                ['week_start' => Carbon::parse($plan->starts_on)->toDateString(), 'schedule' => $gp['schedule']],
            ];
        }

        // Generate any missing weeks up to and including the current week
        for ($i = 0; $i <= $weekIndex; $i++) {
            $plan->refresh();
            $gp = $plan->generated_plan ?? [];
            $weeks = $gp['weeks'] ?? [];
            $this->ensureWeekExists($plan, $i, $weeks);
        }

        $plan->refresh();
        $gp = $plan->generated_plan ?? [];
        $weeks = $gp['weeks'] ?? [];
        $currentWeek = $weeks[$weekIndex] ?? ['schedule' => []];

        $schedule = $currentWeek['schedule'] ?? [];
        $normalized = $this->normalizeGeneratedPlan(['schedule' => $schedule, 'strategy_summary' => $gp['strategy_summary'] ?? '']);

        $planArray = $plan->toArray();
        $planArray['generated_plan'] = array_merge($gp, ['schedule' => $normalized['schedule']]);

        return $planArray;
    }

    /**
     * Ensure the schedule for the given week index exists; generate it if missing.
     */
    protected function ensureWeekExists(StudyPlan $plan, int $weekIndex, array $weeks): void
    {
        if (isset($weeks[$weekIndex])) {
            return;
        }

        $plan->refresh();
        $user = $plan->user;
        $previousSchedule = [];
        if ($weekIndex > 0 && isset($weeks[$weekIndex - 1])) {
            $previousSchedule = $weeks[$weekIndex - 1]['schedule'] ?? [];
        }

        $weekStartDate = Carbon::parse($plan->starts_on)->addWeeks($weekIndex)->toDateString();

        $output = $this->neuron->planner()->createNextWeekPlan([
            'subjects' => $user->subjects,
            'exam_dates' => $user->exam_dates,
            'subject_difficulties' => $user->subject_difficulties,
            'daily_study_hours' => $user->daily_study_hours,
            'productivity_peak' => $user->productivity_peak,
            'learning_style' => $user->learning_style,
            'study_goal' => $user->study_goal,
            'week_number' => $weekIndex + 1,
            'week_start_date' => $weekStartDate,
            'previous_week_schedule' => $previousSchedule,
        ]);

        $newWeekSchedule = $this->normalizeGeneratedPlan((array) $output)['schedule'] ?? [];
        $weeks[$weekIndex] = [
            'week_start' => $weekStartDate,
            'schedule' => $newWeekSchedule,
        ];

        $gp = $plan->generated_plan ?? [];
        if (! is_array($gp)) {
            $gp = [];
        }
        $gp['weeks'] = $weeks;
        $plan->update(['generated_plan' => $gp]);
    }

    /**
     * Regenerate and optimize the plan based on performance analysis.
     */
    public function rebalancePlan(User $user): StudyPlan
    {
        $activePlan = $user->studyPlans()->where('status', 'active')->firstOrFail();

        // Check if rebalance is prevented
        if ($activePlan->prevent_rebalance_until && Carbon::now()->lt($activePlan->prevent_rebalance_until)) {
            throw new \Exception('Plan rebalance is temporarily prevented to allow the new schedule to settle. Please try again later.');
        }

        // Gather performance data
        $recentSessions = $user->studySessions()
            ->where('started_at', '>=', Carbon::now()->subDays(7))
            ->get();
        
        $recentQuizzes = $user->quizResults()
            ->where('taken_at', '>=', Carbon::now()->subDays(7))
            ->get();

        // 1. Analyze performance
        $hasPerformanceData = $recentSessions->isNotEmpty() || $recentQuizzes->isNotEmpty();
        
        if (!$hasPerformanceData) {
            // If no performance data, create a gentle optimization that preserves beginner topics
            $analysis = (object)[
                'insights' => [
                    [
                        'detail' => 'No performance data available. Preserving current topic progression.',
                        'significance' => 'Beginner topics should remain at appropriate difficulty level.'
                    ]
                ],
                'subject_mastery' => [],
                'recommendations' => [
                    'Continue with current topic progression.',
                    'Re-balance recommended after 1-2 weeks of study data.'
                ]
            ];
        } else {
            $analysis = $this->neuron->analyzer()->analyze([
                'study_sessions' => $recentSessions->toArray(),
                'quiz_results' => $recentQuizzes->toArray(),
                'current_plan' => $activePlan->generated_plan,
            ]);
        }

        // 2. Optimize plan
        $optimizationData = [
            'current_plan' => $activePlan->generated_plan,
            'analysis_insights' => (array)$analysis,
            'current_day' => Carbon::today()->format('l'),
            'current_date' => Carbon::today()->toDateString(),
            'user_subjects' => $user->subjects,
            'user_exam_dates' => $user->exam_dates,
            'user_difficulties' => $user->subject_difficulties,
            'daily_study_hours' => $user->daily_study_hours,
            'productivity_peak' => $user->productivity_peak,
            'learning_style' => $user->learning_style,
            'has_performance_data' => $hasPerformanceData,
        ];
        
        $optimization = $this->neuron->optimizer()->optimize($optimizationData);

        // 3. Persist new plan (with weeks structure for weekly rollover)
        return DB::transaction(function () use ($user, $activePlan, $optimization) {
            $activePlan->update(['status' => 'archived']);

            $startsOn = Carbon::today();
            $normalized = $this->normalizeGeneratedPlan([
                'schedule' => $optimization->optimized_schedule,
                'strategy_summary' => $optimization->predicted_improvement,
                'change_log' => $optimization->change_log,
            ]);
            $normalized['weeks'] = [
                ['week_start' => $startsOn->toDateString(), 'schedule' => $normalized['schedule']],
            ];

            return StudyPlan::create([
                'user_id' => $user->id,
                'title' => 'Optimized Recovery Plan',
                'goal' => $activePlan->goal,
                'starts_on' => $startsOn,
                'ends_on' => $activePlan->ends_on,
                'target_hours_per_week' => $activePlan->target_hours_per_week,
                'status' => 'active',
                'preferences' => $activePlan->preferences,
                'generated_plan' => $normalized,
                'prevent_rebalance_until' => Carbon::now()->addHours(12), // Prevent AI re-balance for 12 hours
            ]);
        });
    }

    /**
     * Resolve plan end date from exam dates, or default to 4 weeks from start.
     */
    protected function resolvePlanEndDate(?array $examDates, Carbon $startsOn): Carbon
    {
        $dates = collect($examDates ?? [])
            ->filter(fn ($d) => $d !== null && $d !== '')
            ->map(fn ($d) => Carbon::parse($d));

        if ($dates->isEmpty()) {
            return $startsOn->copy()->addWeeks(4);
        }

        $max = $dates->max();
        return $max->isBefore($startsOn) ? $startsOn->copy()->addWeeks(4) : $max;
    }

    /**
     * Normalize AI-generated plan so schedule always has day keys and sessions are arrays of objects.
     * Public so controllers can normalize existing plans when sending to the frontend.
     */
    public function normalizeGeneratedPlan(array $plan): array
    {
        $schedule = $plan['schedule'] ?? $plan['optimized_schedule'] ?? [];
        if ($schedule === null || ! is_array($schedule)) {
            $schedule = [];
        }
        $dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

        // If AI returned numeric array (e.g. [0 => ['Monday'=>...], 1=>['Tuesday'=>...]]), flatten by day
        $keys = array_keys($schedule);
        $isList = array_is_list($schedule);
        $hasDayKeys = ! empty(array_intersect($dayNames, $keys));
        if (! empty($schedule) && ($isList || ! $hasDayKeys)) {
            $byDay = [];
            foreach ($schedule as $entry) {
                if (! is_array($entry)) {
                    continue;
                }
                foreach ($dayNames as $day) {
                    if (isset($entry[$day])) {
                        $byDay[$day] = $entry[$day];
                        break;
                    }
                }
            }
            $schedule = $byDay;
        }

        $normalized = [];
        foreach ($dayNames as $day) {
            $dayData = $schedule[$day] ?? null;
            $sessions = $this->normalizeDaySessions($dayData);
            $normalized[$day] = ['sessions' => $sessions];
        }

        $plan['schedule'] = $normalized;
        unset($plan['optimized_schedule']);
        return $plan;
    }

    /**
     * Ensure sessions for a day are an array of objects (subject, topic, duration_minutes, focus_level).
     */
    protected function normalizeDaySessions(mixed $dayData): array
    {
        $raw = null;
        if (is_array($dayData)) {
            $raw = $dayData['sessions'] ?? $dayData;
        }
        if (is_array($raw)) {
            $raw = $raw;
        } else {
            $raw = [];
        }

        $out = [];
        foreach ($raw as $s) {
            if ($s === null) {
                continue;
            }
            if (is_array($s) && isset($s['subject'])) {
                $keyTopics = $s['key_topics'] ?? $s['keyTopics'] ?? $s['topics'] ?? $s['key_points'] ?? [];
                if (is_string($keyTopics)) {
                    $keyTopics = array_values(array_filter(array_map('trim', preg_split('/[,;]+/', $keyTopics))));
                }
                if (! is_array($keyTopics)) {
                    $keyTopics = [];
                }
                $resources = $s['resources'] ?? $s['resource_links'] ?? $s['links'] ?? [];
                if (is_string($resources)) {
                    $resources = array_values(array_filter(array_map('trim', preg_split('/[,;]+/', $resources))));
                }
                if (! is_array($resources)) {
                    $resources = [];
                }
                $normalizedResources = [];
                foreach ($resources as $resource) {
                    if (is_string($resource)) {
                        $trimmed = trim($resource);
                        if ($trimmed !== '') {
                            $normalizedResources[] = ['title' => $trimmed, 'url' => $this->sanitizeResourceUrl($trimmed, $trimmed, ''), 'type' => ''];
                        }
                        continue;
                    }
                    if (! is_array($resource)) {
                        continue;
                    }
                    $title = (string) ($resource['title'] ?? $resource['name'] ?? $resource['label'] ?? '');
                    $url = (string) ($resource['url'] ?? $resource['link'] ?? '');
                    
                    // Handle AI-generated "site:domain.com Title text" format in title
                    if (str_contains($title, 'site:')) {
                        if (preg_match('/site:([^\s]+)/', $title, $matches)) {
                            $domain = $matches[1];
                            $url = 'https://' . $domain;
                            $title = trim(preg_replace('/site:[^\s]+\s*/', '', $title));
                        }
                    }
                    
                    // Handle "site:domain.com" in URL field
                    if (str_contains($url, 'site:')) {
                        if (preg_match('/site:([^\s]+)/', $url, $matches)) {
                            $domain = $matches[1];
                            $url = 'https://' . $domain;
                        }
                    }
                    
                    if ($title === '' && $url !== '') {
                        $title = $url;
                    }
                    if ($url === '' && $title !== '') {
                        $url = $title;
                    }
                    
                    $url = $this->sanitizeResourceUrl($url, $title, '');
                    
                    $type = (string) ($resource['type'] ?? $resource['kind'] ?? '');
                    $normalizedResources[] = [
                        'title' => $title,
                        'url' => $url,
                        'type' => $type,
                    ];
                }
                $resources = $normalizedResources;
                $subjectVal = (string) ($s['subject'] ?? 'Study Session');
                $topicVal = (string) ($s['topic'] ?? '');
                if (empty($keyTopics)) {
                    $keyTopics = $this->defaultKeyTopics($subjectVal, $topicVal);
                }
                if (empty($resources)) {
                    $resources = $this->defaultResources($subjectVal);
                }
                $out[] = [
                    'subject' => $subjectVal,
                    'topic' => $topicVal,
                    'duration_minutes' => $this->parseDuration($s['duration_minutes'] ?? $s['duration'] ?? null),
                    'focus_level' => in_array($s['focus_level'] ?? '', ['low', 'medium', 'high'], true)
                        ? $s['focus_level']
                        : 'medium',
                    'key_topics' => $keyTopics,
                    'resources' => $resources,
                ];
                continue;
            }
            if (is_string($s)) {
                $trimmed = trim($s);
                // If AI returned a JSON string, parse it into a session object
                if (str_starts_with($trimmed, '{')) {
                    $decoded = json_decode($trimmed, true);
                    if (is_array($decoded) && isset($decoded['subject'])) {
                        $keyTopics = $decoded['key_topics'] ?? $decoded['keyTopics'] ?? $decoded['topics'] ?? $decoded['key_points'] ?? [];
                        if (is_string($keyTopics)) {
                            $keyTopics = array_values(array_filter(array_map('trim', preg_split('/[,;]+/', $keyTopics))));
                        }
                        if (! is_array($keyTopics)) {
                            $keyTopics = [];
                        }
                        $resources = $decoded['resources'] ?? $decoded['resource_links'] ?? $decoded['links'] ?? [];
                        if (is_string($resources)) {
                            $resources = array_values(array_filter(array_map('trim', preg_split('/[,;]+/', $resources))));
                        }
                        if (! is_array($resources)) {
                            $resources = [];
                        }
                        $normalizedResources = [];
                        foreach ($resources as $resource) {
                            if (is_string($resource)) {
                                $trimmed = trim($resource);
                                if ($trimmed !== '') {
                                    $normalizedResources[] = ['title' => $trimmed, 'url' => $this->sanitizeResourceUrl($trimmed, $trimmed, ''), 'type' => ''];
                                }
                                continue;
                            }
                            if (! is_array($resource)) {
                                continue;
                            }
                            $title = (string) ($resource['title'] ?? $resource['name'] ?? $resource['label'] ?? '');
                            $url = (string) ($resource['url'] ?? $resource['link'] ?? '');
                            
                            // Handle AI-generated "site:domain.com Title text" format in title
                            if (str_contains($title, 'site:')) {
                                if (preg_match('/site:([^\s]+)/', $title, $matches)) {
                                    $domain = $matches[1];
                                    $url = 'https://' . $domain;
                                    $title = trim(preg_replace('/site:[^\s]+\s*/', '', $title));
                                }
                            }
                            
                            // Handle "site:domain.com" in URL field
                            if (str_contains($url, 'site:')) {
                                if (preg_match('/site:([^\s]+)/', $url, $matches)) {
                                    $domain = $matches[1];
                                    $url = 'https://' . $domain;
                                }
                            }
                            
                            if ($title === '' && $url !== '') {
                                $title = $url;
                            }
                            if ($url === '' && $title !== '') {
                                $url = $title;
                            }
                            
                            $url = $this->sanitizeResourceUrl($url, $title, '');
                            
                            $type = (string) ($resource['type'] ?? $resource['kind'] ?? '');
                            $normalizedResources[] = [
                                'title' => $title,
                                'url' => $url,
                                'type' => $type,
                            ];
                        }
                        $resources = $normalizedResources;
                        $subjectVal = (string) ($decoded['subject'] ?? 'Study Session');
                        $topicVal = (string) ($decoded['topic'] ?? '');
                        if (empty($keyTopics)) {
                            $keyTopics = $this->defaultKeyTopics($subjectVal, $topicVal);
                        }
                        if (empty($resources)) {
                            $resources = $this->defaultResources($subjectVal);
                        }
                        $out[] = [
                            'subject' => $subjectVal,
                            'topic' => $topicVal,
                            'duration_minutes' => $this->parseDuration($decoded['duration_minutes'] ?? $decoded['duration'] ?? null),
                            'focus_level' => in_array($decoded['focus_level'] ?? '', ['low', 'medium', 'high'], true)
                                ? $decoded['focus_level']
                                : 'medium',
                            'key_topics' => $keyTopics,
                            'resources' => $resources,
                        ];
                        continue;
                    }
                }
                $subjectVal = trim(explode(':', $trimmed)[0] ?? 'Study Session');
                $topicVal = $trimmed;
                $out[] = [
                    'subject' => $subjectVal,
                    'topic' => $topicVal,
                    'duration_minutes' => 60,
                    'focus_level' => 'medium',
                    'key_topics' => $this->defaultKeyTopics($subjectVal, $topicVal),
                    'resources' => $this->defaultResources($subjectVal),
                ];
                continue;
            }
        }
        return $out;
    }

    protected function defaultKeyTopics(string $subject, string $topic): array
    {
        $base = trim($topic) !== '' ? $topic : $subject;
        return [
            $base.' overview',
            'Core concepts and definitions',
            'Practice exercises and review',
        ];
    }

    protected function defaultResources(string $subject): array
    {
        $name = strtolower($subject);

        if (str_contains($name, 'math') || str_contains($name, 'calculus') || str_contains($name, 'algebra') || str_contains($name, 'geometry') || str_contains($name, 'statistics')) {
            return [
                ['title' => 'Khan Academy – Math', 'url' => 'https://www.khanacademy.org/math', 'type' => 'course'],
                ['title' => '3Blue1Brown', 'url' => 'https://www.youtube.com/@3blue1brown', 'type' => 'video'],
                ['title' => 'Paul\'s Online Math Notes', 'url' => 'https://tutorial.math.lamar.edu/', 'type' => 'article'],
                ['title' => 'MIT OCW', 'url' => 'https://www.youtube.com/@mitocw', 'type' => 'video'],
            ];
        }
        if (str_contains($name, 'physics')) {
            return [
                ['title' => 'Khan Academy – Physics', 'url' => 'https://www.khanacademy.org/science/physics', 'type' => 'course'],
                ['title' => 'The Physics Classroom', 'url' => 'https://www.physicsclassroom.com/', 'type' => 'article'],
                ['title' => 'Physics Videos', 'url' => 'https://www.youtube.com/results?search_query=physics+lectures', 'type' => 'video'],
                ['title' => 'CrashCourse', 'url' => 'https://www.youtube.com/@crashcourse', 'type' => 'video'],
            ];
        }
        if (str_contains($name, 'chemistry')) {
            return [
                ['title' => 'Khan Academy – Chemistry', 'url' => 'https://www.khanacademy.org/science/chemistry', 'type' => 'course'],
                ['title' => 'Professor Dave Explains', 'url' => 'https://www.youtube.com/@ProfessorDaveExplains', 'type' => 'video'],
                ['title' => 'LibreTexts Chemistry', 'url' => 'https://chem.libretexts.org/', 'type' => 'article'],
                ['title' => 'CrashCourse', 'url' => 'https://www.youtube.com/@crashcourse', 'type' => 'video'],
            ];
        }
        if (str_contains($name, 'biology')) {
            return [
                ['title' => 'Khan Academy – Biology', 'url' => 'https://www.khanacademy.org/science/biology', 'type' => 'course'],
                ['title' => 'Amoeba Sisters', 'url' => 'https://www.youtube.com/@AmoebaSisters', 'type' => 'video'],
                ['title' => 'LibreTexts Biology', 'url' => 'https://bio.libretexts.org/', 'type' => 'article'],
                ['title' => 'CrashCourse', 'url' => 'https://www.youtube.com/@crashcourse', 'type' => 'video'],
            ];
        }
        if (str_contains($name, 'python')) {
            return [
                ['title' => 'Python Official Docs', 'url' => 'https://docs.python.org/3/', 'type' => 'article'],
                ['title' => 'freeCodeCamp – Python', 'url' => 'https://www.freecodecamp.org/learn/scientific-computing-with-python/', 'type' => 'course'],
                ['title' => 'Corey Schafer', 'url' => 'https://www.youtube.com/@coreyms', 'type' => 'video'],
                ['title' => 'Programming with Mosh', 'url' => 'https://www.youtube.com/@programmingwithmosh', 'type' => 'video'],
            ];
        }
        if (str_contains($name, 'javascript') || str_contains($name, 'typescript')) {
            return [
                ['title' => 'MDN Web Docs', 'url' => 'https://developer.mozilla.org/en-US/docs/Web/JavaScript', 'type' => 'article'],
                ['title' => 'freeCodeCamp – JavaScript', 'url' => 'https://www.freecodecamp.org/learn/javascript-algorithms-and-data-structures-v8/', 'type' => 'course'],
                ['title' => 'Traversy Media', 'url' => 'https://www.youtube.com/@TraversyMedia', 'type' => 'video'],
                ['title' => 'Fireship', 'url' => 'https://www.youtube.com/@Fireship', 'type' => 'video'],
            ];
        }
        if (str_contains($name, 'programming') || str_contains($name, 'computer') || str_contains($name, 'coding') || str_contains($name, 'java') || str_contains($name, 'c++') || str_contains($name, 'c#')) {
            return [
                ['title' => 'freeCodeCamp', 'url' => 'https://www.freecodecamp.org/', 'type' => 'course'],
                ['title' => 'GeeksforGeeks', 'url' => 'https://www.geeksforgeeks.org/', 'type' => 'article'],
                ['title' => 'CS50', 'url' => 'https://www.youtube.com/@cs50', 'type' => 'video'],
                ['title' => 'Computerphile', 'url' => 'https://www.youtube.com/@Computerphile', 'type' => 'video'],
            ];
        }
        if (str_contains($name, 'machine learning') || str_contains($name, 'deep learning')) {
            return [
                ['title' => 'Andrew Ng – ML Course', 'url' => 'https://www.coursera.org/learn/machine-learning', 'type' => 'course'],
                ['title' => 'fast.ai Practical Deep Learning', 'url' => 'https://course.fast.ai/', 'type' => 'course'],
                ['title' => 'StatQuest', 'url' => 'https://www.youtube.com/@statquest', 'type' => 'video'],
                ['title' => '3Blue1Brown', 'url' => 'https://www.youtube.com/@3blue1brown', 'type' => 'video'],
            ];
        }
        if (str_contains($name, 'data science') || str_contains($name, 'ai')) {
            return [
                ['title' => 'Kaggle Learn', 'url' => 'https://www.kaggle.com/learn', 'type' => 'course'],
                ['title' => 'Google AI Education', 'url' => 'https://ai.google/education/', 'type' => 'course'],
                ['title' => 'StatQuest', 'url' => 'https://www.youtube.com/@statquest', 'type' => 'video'],
                ['title' => 'Data Science Dojo', 'url' => 'https://www.youtube.com/@DataScienceDojo', 'type' => 'video'],
            ];
        }
        if (str_contains($name, 'history')) {
            return [
                ['title' => 'Khan Academy – History', 'url' => 'https://www.khanacademy.org/humanities/world-history', 'type' => 'course'],
                ['title' => 'CrashCourse', 'url' => 'https://www.youtube.com/@crashcourse', 'type' => 'video'],
                ['title' => 'History.com', 'url' => 'https://www.history.com/', 'type' => 'article'],
                ['title' => 'Extra History', 'url' => 'https://www.youtube.com/@Extrahistory', 'type' => 'video'],
            ];
        }
        if (str_contains($name, 'economics')) {
            return [
                ['title' => 'Khan Academy – Economics', 'url' => 'https://www.khanacademy.org/economics-finance-domain', 'type' => 'course'],
                ['title' => 'CrashCourse', 'url' => 'https://www.youtube.com/@crashcourse', 'type' => 'video'],
                ['title' => 'Investopedia', 'url' => 'https://www.investopedia.com/', 'type' => 'article'],
                ['title' => 'Economics Explained', 'url' => 'https://www.youtube.com/@EconomicsExplained', 'type' => 'video'],
            ];
        }
        if (str_contains($name, 'psychology')) {
            return [
                ['title' => 'CrashCourse', 'url' => 'https://www.youtube.com/@crashcourse', 'type' => 'video'],
                ['title' => 'Simply Psychology', 'url' => 'https://www.simplypsychology.org/', 'type' => 'article'],
                ['title' => 'Khan Academy – Health & Medicine', 'url' => 'https://www.khanacademy.org/science/health-and-medicine', 'type' => 'course'],
                ['title' => 'The School of Life', 'url' => 'https://www.youtube.com/@theschooloflifetv', 'type' => 'video'],
            ];
        }
        if (str_contains($name, 'english') || str_contains($name, 'literature') || str_contains($name, 'writing')) {
            return [
                ['title' => 'Khan Academy – Grammar', 'url' => 'https://www.khanacademy.org/humanities/grammar', 'type' => 'course'],
                ['title' => 'Purdue OWL', 'url' => 'https://owl.purdue.edu/', 'type' => 'article'],
                ['title' => 'CrashCourse', 'url' => 'https://www.youtube.com/@crashcourse', 'type' => 'video'],
                ['title' => 'English with Lucy', 'url' => 'https://www.youtube.com/@EnglishwithLucy', 'type' => 'video'],
            ];
        }
        if (str_contains($name, 'geography')) {
            return [
                ['title' => 'National Geographic Education', 'url' => 'https://education.nationalgeographic.org/', 'type' => 'article'],
                ['title' => 'CrashCourse', 'url' => 'https://www.youtube.com/@crashcourse', 'type' => 'video'],
                ['title' => 'Khan Academy – World History', 'url' => 'https://www.khanacademy.org/humanities/world-history', 'type' => 'course'],
                ['title' => 'Geography Now', 'url' => 'https://www.youtube.com/@GeographyNow', 'type' => 'video'],
            ];
        }
        if (str_contains($name, 'language') || str_contains($name, 'spanish') || str_contains($name, 'french') || str_contains($name, 'german') || str_contains($name, 'chinese') || str_contains($name, 'japanese') || str_contains($name, 'korean')) {
            return [
                ['title' => 'Duolingo', 'url' => 'https://www.duolingo.com/', 'type' => 'course'],
                ['title' => 'BBC Languages', 'url' => 'https://www.bbc.co.uk/languages', 'type' => 'article'],
                ['title' => 'Language Learning YouTube', 'url' => 'https://www.youtube.com/c/LanguageLearning', 'type' => 'video'],
                ['title' => 'Forvo Pronunciation', 'url' => 'https://forvo.com/', 'type' => 'tool'],
            ];
        }
        return [
            ['title' => 'Khan Academy', 'url' => 'https://www.khanacademy.org/', 'type' => 'course'],
            ['title' => 'CrashCourse', 'url' => 'https://www.youtube.com/@crashcourse', 'type' => 'video'],
            ['title' => 'Wikipedia', 'url' => 'https://en.wikipedia.org/wiki/Main_Page', 'type' => 'article'],
            ['title' => 'TED-Ed', 'url' => 'https://www.youtube.com/@TEDEd', 'type' => 'video'],
        ];
    }

    /**
     * Sanitize a resource URL - ensure it's valid, but don't redirect to search.
     * Returns the URL as-is if valid, or converts to YouTube search if invalid.
     */
    protected function sanitizeResourceUrl(string $url, string $title, string $type): string
    {
        $url = trim($url);

        // AI sometimes generates "site:domain.com Title text" as the URL
        // Extract just the domain from site: patterns
        if (str_contains($url, 'site:')) {
            // Pattern: "site:domain.com" or "site:domain.com Title"
            if (preg_match('/site:([^\s]+)/', $url, $matches)) {
                $domain = $matches[1];
                // Ensure https:// prefix
                if (!str_starts_with($domain, 'http')) {
                    return 'https://' . $domain;
                }
                return $domain;
            }
        }

        // Not a valid URL at all — convert title to YouTube search
        if (! filter_var($url, FILTER_VALIDATE_URL)) {
            return 'https://www.youtube.com/results?search_query=' . rawurlencode($title . ' tutorial');
        }

        // Valid URL — return as-is (user goes directly to the page)
        return $url;
    }

    protected function parseDuration(mixed $val): int
    {
        if ($val === null) return 60;

        // If explicitly numeric
        if (is_numeric($val)) {
            $intVal = (int) $val;
            // Heuristic: If value is <= 12, assume it's hours and convert to minutes.
            // It is extremely unlikely a study session is 1 to 12 minutes long.
            return $intVal > 0 && $intVal <= 12 ? $intVal * 60 : $intVal;
        }

        // If string (e.g., "1.5 hours", "2h")
        if (is_string($val)) {
            $cleaned = strtolower(trim($val));
            if (str_contains($cleaned, 'hour') || str_contains($cleaned, ' h')) {
                return (int) ((float) $cleaned * 60);
            }
            // Fallback: try parsing as int
            $parsed = (int) $cleaned;
            return $this->parseDuration($parsed);
        }

        return 60;
    }
}
