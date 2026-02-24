<?php

namespace App\Services;

use App\AI\Neuron\NeuronService;
use App\AI\Neuron\Output\PlannerOutput;
use App\Models\StudyPlan;
use App\Models\User;
use App\Services\SubjectCurriculumTemplates;
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
        $timezone = $user->timezone ?? config('app.timezone');
        $today = Carbon::today($timezone);

        $learningPaths = $user->learningPaths()
            ->where('status', 'active')
            ->get()
            ->mapWithKeys(function ($path) {
                return [$path->subject_name => $path->curriculum];
            })->toArray();

        $data = [
            'subjects' => $user->subjects,
            'subject_difficulties' => $user->subject_difficulties,
            'subject_session_durations' => $user->subject_session_durations ?? [],
            'subject_start_dates' => $user->subject_start_dates ?? [],
            'subject_end_dates' => $user->subject_end_dates ?? [],
            'learning_paths' => $learningPaths,
            'daily_study_hours' => $user->daily_study_hours,
            'study_goal' => $user->study_goal,
            'current_day' => $today->format('l'),
            'current_date' => $today->toDateString(),
        ];

        return $this->generatePlanWithData($user, $data);
    }

    /**
     * Generate a study plan with specific data (for settings updates).
     */
    public function generatePlanWithData(User $user, array $data): StudyPlan
    {
        $timezone = $user->timezone ?? config('app.timezone');
        $today = Carbon::today($timezone);

        // Ensure fresh data is passed to AI with cycle context
        // Standardized to 30-day (Monthly) cycles
        $planDuration = 'monthly';
        $cycleDays = 30;
        $planData = array_merge($data, [
            'current_day' => $today->format('l'),
            'current_date' => $today->toDateString(),
            'cycle_days' => $cycleDays,
            'planning_mode' => 'adaptive_cycle',
            'cycle_instruction' => "Generate a study schedule for ONLY the next {$cycleDays} days. Pace the content to cover all material by the end dates.",
        ]);

        \Log::info('=== Calling AI planner ===');
        $plannerOutput = $this->neuron->planner()->createPlan($planData);
        $output = $this->plannerOutputToArray($plannerOutput);
        \Log::info('=== AI planner output type ===', [
            'class' => is_object($plannerOutput) ? get_class($plannerOutput) : gettype($plannerOutput),
            'has_schedule' => isset($output['schedule']),
            'schedule_keys' => isset($output['schedule']) ? array_keys($output['schedule']) : [],
        ]);

        return DB::transaction(function () use ($user, $output, $planData, $today) {
            // Get the old active plan before any changes
            $oldActivePlan = $user->studyPlans()->where('status', 'active')->first();
            
            $startsOn = $today;
            $endsOn = $this->resolvePlanEndDate($planData['subject_end_dates'] ?? [], $startsOn);

            $normalized = $this->normalizeGeneratedPlan((array) $output);
            \Log::info('=== Normalized schedule snapshot ===', [
                'monday_sessions' => $normalized['schedule']['Monday']['sessions'] ?? [],
            ]);
            $normalized['weeks'] = [
                [
                    'week_start' => $startsOn->toDateString(),
                    'schedule' => $normalized['schedule'],
                ],
            ];

            // Create the new plan FIRST
            $newPlan = StudyPlan::create([
                'user_id' => $user->id,
                'title' => "Study Plan",
                'goal' => $planData['study_goal'] ?? $user->study_goal,
                'starts_on' => $startsOn,
                'ends_on' => $endsOn,
                'target_hours_per_week' => ($planData['daily_study_hours'] ?? $user->daily_study_hours) * 7,
                'status' => 'active',
                'generated_plan' => $normalized,
                'prevent_rebalance_until' => Carbon::now()->addHours(24), // Prevent AI re-balance for 24 hours
            ]);

            // MIGRATE SESSIONS from old plan to new plan
            if ($oldActivePlan) {
                $migratedCount = $user->studySessions()
                    ->where('study_plan_id', $oldActivePlan->id)
                    ->update(['study_plan_id' => $newPlan->id]);
                
                // Log the migration for debugging
                \Log::info('Migrated study sessions to new plan', [
                    'user_id' => $user->id,
                    'old_plan_id' => $oldActivePlan->id,
                    'new_plan_id' => $newPlan->id,
                    'migrated_sessions' => $migratedCount,
                ]);

                // Preserve completed session status by updating metadata to match new plan
                $this->preserveCompletedSessions($user, $newPlan, $normalized['schedule']);
            }

            // NOW archive the old plan (after sessions are safely migrated)
            if ($oldActivePlan) {
                $oldActivePlan->update(['status' => 'archived']);
            }

            return $newPlan;
        });
    }

    /**
     * Get the plan with generated_plan.schedule set to the current week's schedule.
     * Generates the next week's schedule when the user has moved into a new week.
     * 
     * @param StudyPlan $plan The study plan
     * @param string|null $targetDate Optional target date (Y-m-d format). Defaults to today.
     * @return array
     */
    public function getPlanForCurrentWeek(StudyPlan $plan, ?string $targetDate = null): array
    {
        $plan->refresh();
        $gp = $plan->generated_plan ?? [];
        if (! is_array($gp)) {
            $gp = [];
        }

        $userTz = $plan->user->timezone ?? config('app.timezone');
        $startsOn = Carbon::parse($plan->starts_on, $userTz)->startOfDay();
        $endsOn = Carbon::parse($plan->ends_on, $userTz)->endOfDay();
        $today = $targetDate ? Carbon::parse($targetDate, $userTz)->startOfDay() : Carbon::today($userTz)->startOfDay();

        // Determine if cycle is complete
        $isCycleComplete = $today->gt($endsOn);
        $daysRemaining = max(0, (int) $today->diffInDays($endsOn, false));

        $daysSinceStart = $startsOn->diffInDays($today, false);
        $weekIndex = (int) floor($daysSinceStart / 7);

        // Cap weeks to the plan's intended duration (use startOfDay for accurate week count)
        $maxWeeks = max(1, (int) ceil($startsOn->diffInDays($endsOn->copy()->startOfDay()) / 7));
        if ($weekIndex >= $maxWeeks) {
            $weekIndex = $maxWeeks - 1;
        }
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

        // Generate any missing weeks up to and including the current week (within bounds)
        // ensureWeekExists handles its own DB refresh internally when it writes a new week.
        for ($i = 0; $i <= $weekIndex; $i++) {
            // Re-read weeks from DB before each check so we see any week written in a
            // previous iteration (ensureWeekExists saves back to the DB).
            $plan->refresh();
            $gp    = $plan->generated_plan ?? [];
            $weeks = $gp['weeks'] ?? [];
            $this->ensureWeekExists($plan, $i, $weeks);
        }

        // One final refresh to pick up the last week written inside the loop.
        $plan->refresh();
        $gp    = $plan->generated_plan ?? [];
        $weeks = $gp['weeks'] ?? [];
        $currentWeek = $weeks[$weekIndex] ?? ['schedule' => []];

        $schedule = $currentWeek['schedule'] ?? [];
        $normalized = $this->normalizeGeneratedPlan(['schedule' => $schedule, 'strategy_summary' => $gp['strategy_summary'] ?? '']);

        $planArray = $plan->toArray();
        $planArray['generated_plan'] = array_merge($gp, [
            'schedule' => $normalized['schedule'],
            'is_cycle_complete' => $isCycleComplete,
            'days_remaining' => $daysRemaining,
            'current_week' => $weekIndex + 1,
            'total_weeks' => $maxWeeks,
        ]);

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

        // Gather topic history to prevent looping
        $allCoveredTopics = $this->extractCoveredTopics($weeks, $weekIndex);
        $completedTopics = $this->getCompletedTopicsFromSessions($user, $plan);

        // Standardized to 30-day (Monthly) cycles
        $planDuration = 'monthly';
        $cycleDays = 30;

        $output = $this->neuron->planner()->createNextWeekPlan([
            'subjects' => $user->subjects,
            'subject_difficulties' => $user->subject_difficulties,
            'subject_start_dates' => $user->subject_start_dates ?? [],
            'subject_end_dates' => $user->subject_end_dates ?? [],
            'daily_study_hours' => $user->daily_study_hours,
            'study_goal' => $user->study_goal,
            'subject_session_durations' => $user->subject_session_durations ?? [],
            'cycle_days' => $cycleDays,
            'planning_mode' => 'adaptive_cycle',
            'cycle_instruction' => "Generate a study schedule for ONLY the next 7 days within a {$cycleDays}-day cycle. Pace content so the student finishes all material by end dates, but only show this week's portion.",
            'week_number' => $weekIndex + 1,
            'week_start_date' => $weekStartDate,
            'previous_week_schedule' => $previousSchedule,
            'all_covered_topics' => $allCoveredTopics,
            'completed_topics' => $completedTopics,
            'learning_paths' => $user->learningPaths()
                ->where('status', 'active')
                ->get()
                ->mapWithKeys(function ($path) {
                    return [$path->subject_name => $path->curriculum];
                })->toArray(),
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
        // Safety: Ensure all learning path durations are perfectly balanced before optimizing
        app(\App\Services\LearningPathService::class)->rebalanceDurationsForUser($user);

        $timezone = $user->timezone ?? config('app.timezone');
        $activePlan = $user->studyPlans()->where('status', 'active')->firstOrFail();

        // Check if rebalance is prevented
        if ($activePlan->prevent_rebalance_until && Carbon::now($timezone)->lt(Carbon::parse($activePlan->prevent_rebalance_until, $timezone))) {
            throw new \Exception('Plan rebalance is temporarily prevented to allow the new schedule to settle. Please try again later.');
        }

        // Gather performance data
        $recentSessions = $user->studySessions()
            ->where('started_at', '>=', Carbon::now($timezone)->subDays(7))
            ->get();
        
        $recentQuizzes = $user->quizResults()
            ->where('taken_at', '>=', Carbon::now($timezone)->subDays(7))
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
            'current_day' => Carbon::today($timezone)->format('l'),
            'current_date' => Carbon::today($timezone)->toDateString(),
            'user_subjects' => $user->subjects,
            'subject_start_dates' => $user->subject_start_dates ?? [],
            'subject_end_dates' => $user->subject_end_dates ?? [],
            'user_difficulties' => $user->subject_difficulties,
            'daily_study_hours' => $user->daily_study_hours,
            'study_goal' => $user->study_goal,
            'subject_session_durations' => $user->subject_session_durations ?? [],
            'has_performance_data' => $hasPerformanceData,
            'learning_paths' => $user->learningPaths()
                ->where('status', 'active')
                ->get()
                ->mapWithKeys(function ($path) {
                    return [$path->subject_name => $path->curriculum];
                })->toArray(),
        ];
        
        $optimization = $this->neuron->optimizer()->optimize($optimizationData);

        // 3. Persist new plan (with weeks structure for weekly rollover)
        return DB::transaction(function () use ($user, $activePlan, $optimization, $timezone) {
            // Store the old plan ID before any changes
            $oldPlanId = $activePlan->id;

            $startsOn = Carbon::today($timezone);
            $normalized = $this->normalizeGeneratedPlan([
                'schedule' => $optimization->optimized_schedule,
                'strategy_summary' => $optimization->predicted_improvement,
                'change_log' => $optimization->change_log,
            ]);
            $normalized['weeks'] = [
                ['week_start' => $startsOn->toDateString(), 'schedule' => $normalized['schedule']],
            ];

            // Create the new plan FIRST
            $newPlan = StudyPlan::create([
                'user_id' => $user->id,
                'title' => 'Optimized Recovery Plan',
                'goal' => $activePlan->goal,
                'starts_on' => $startsOn,
                'ends_on' => $activePlan->ends_on,
                'target_hours_per_week' => $activePlan->target_hours_per_week,
                'status' => 'active',
                'generated_plan' => $normalized,
                'prevent_rebalance_until' => Carbon::now($timezone)->addHours(12), // Prevent AI re-balance for 12 hours
            ]);

            // MIGRATE SESSIONS from old plan to new plan
            $migratedCount = $user->studySessions()
                ->where('study_plan_id', $oldPlanId)
                ->update(['study_plan_id' => $newPlan->id]);
            
            // Log the migration for debugging
            \Log::info('Migrated study sessions during rebalance', [
                'user_id' => $user->id,
                'old_plan_id' => $oldPlanId,
                'new_plan_id' => $newPlan->id,
                'migrated_sessions' => $migratedCount,
            ]);

            // Preserve completed session status by updating metadata to match new plan
            $this->preserveCompletedSessions($user, $newPlan, $normalized['schedule']);

            // NOW archive the old plan (after sessions are safely migrated)
            $activePlan->update(['status' => 'archived']);

            return $newPlan;
        });
    }

    /**
     * Resolve plan end date based on the farthest subject end date.
     * Falls back to 30 days if no end dates are provided.
     */
    protected function resolvePlanEndDate(?array $endDates, Carbon $startsOn): Carbon
    {
        if (!empty($endDates)) {
            $farthest = collect($endDates)
                ->filter()
                ->map(fn ($d) => Carbon::parse($d))
                ->max();

            if ($farthest && $farthest->gt($startsOn)) {
                return $farthest;
            }
        }

        return $startsOn->copy()->addDays(29); // Fallback: 30 days
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
                $duration = $this->parseDuration($s['duration_minutes'] ?? $s['duration'] ?? null);
                
                // Validate and cap session duration
                if ($duration > 240) {
                    $duration = 240; // Cap at maximum 240 minutes (4 hours)
                } elseif ($duration < 15) {
                    $duration = 15; // Minimum 15 minutes
                }
                
                $out[] = [
                    'subject' => $subjectVal,
                    'topic' => $topicVal,
                    'duration_minutes' => $duration,
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
        $topics = SubjectCurriculumTemplates::getTopicsForSubject($subject);
        // Pick 3 beginner topics as key_topics fallback (they're subject-specific)
        $beginnerTopics = $topics['beginner'] ?? [];

        if (!empty($beginnerTopics)) {
            return array_slice($beginnerTopics, 0, 3);
        }

        $base = trim($topic) !== '' ? $topic : $subject;
        return [
            $base.' overview',
            "{$subject} core principles",
            "{$subject} practice exercises",
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
     * Sanitize a resource URL.
     * - YouTube videos must be converted to search URLs.
     * - Documentation/resources must point to trusted official domains only.
     * - If the URL cannot be verified, return an empty string so fallback resources are used.
     */
    protected function sanitizeResourceUrl(string $url, string $title, string $type): string
    {
        $url = trim($url);

        // Handle "site:domain.com" hints from AI
        if (str_contains($url, 'site:')) {
            if (preg_match('/site:([^\s]+)/', $url, $matches)) {
                $domain = $matches[1];
                if (! str_starts_with($domain, 'http')) {
                    $domain = 'https://' . $domain;
                }
                $url = $domain;
            }
        }

        // Ensure we have a valid URL structure
        if (! filter_var($url, FILTER_VALIDATE_URL)) {
            return '';
        }

        $parsed = parse_url($url);
        $host = $parsed['host'] ?? '';

        // Convert direct YouTube links to search URLs (always allowed)
        if (str_contains($host, 'youtube.com') || str_contains($host, 'youtu.be')) {
            return 'https://www.youtube.com/results?search_query=' . rawurlencode($title . ' ' . $type . ' tutorial');
        }

        // Trusted documentation/content domains list (official docs + well-known platforms)
        $trustedDomains = [
            'react.dev', 'reactjs.org', 'vuejs.org', 'angular.io', 'svelte.dev',
            'developer.mozilla.org', 'nextjs.org', 'nuxt.com', 'python.org', 'docs.python.org',
            'pytorch.org', 'tensorflow.org', 'laravel.com', 'symfony.com', 'rubyonrails.org',
            'nodejs.org', 'deno.land', 'go.dev', 'kotlinlang.org', 'swift.org',
            'docs.oracle.com', 'kubernetes.io', 'docker.com', 'developer.apple.com',
            'microsoft.com', 'learn.microsoft.com', 'cloud.google.com', 'aws.amazon.com',
            'docs.github.com', 'git-scm.com', 'gnu.org', 'rust-lang.org', 'elixir-lang.org',
            'php.net', 'docs.djangoproject.com', 'flask.palletsprojects.com', 'fastapi.tiangolo.com',
            'matplotlib.org', 'scipy.org', 'numpy.org', 'pandas.pydata.org',
            'mathworks.com', 'wolframalpha.com', 'khanacademy.org', 'coursera.org', 'edx.org',
            'mit.edu', 'stanford.edu', 'harvard.edu', 'cmu.edu',
            'geeksforgeeks.org', 'wikipedia.org', 'docs.aws.amazon.com', 'docs.microsoft.com',
        ];

        $hostWithoutWww = preg_replace('/^www\./', '', $host);
        $isTrusted = collect($trustedDomains)->contains(function ($domain) use ($hostWithoutWww) {
            return $hostWithoutWww === $domain || str_ends_with($hostWithoutWww, '.' . $domain);
        });

        if (! $isTrusted && $type === 'article') {
            // If the host isn't trusted for documentation, drop it so fallback resources are used
            return '';
        }

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

    /**
     * Extract all topics that were scheduled in previous weeks (from stored week data).
     * Returns an associative array: subject => [topic1, topic2, ...]
     */
    protected function extractCoveredTopics(array $weeks, int $upToWeekIndex): array
    {
        $covered = [];

        for ($i = 0; $i < $upToWeekIndex; $i++) {
            if (! isset($weeks[$i]['schedule'])) {
                continue;
            }

            $schedule = $weeks[$i]['schedule'];
            foreach ($schedule as $dayData) {
                $sessions = [];
                if (is_array($dayData)) {
                    $sessions = $dayData['sessions'] ?? $dayData;
                }

                foreach ($sessions as $session) {
                    if (! is_array($session)) {
                        continue;
                    }
                    $subject = $session['subject'] ?? null;
                    $topic = $session['topic'] ?? null;
                    if ($subject && $topic) {
                        $covered[$subject] = $covered[$subject] ?? [];
                        if (! in_array($topic, $covered[$subject], true)) {
                            $covered[$subject][] = $topic;
                        }
                    }
                }
            }
        }

        return $covered;
    }

    /**
     * Get topics the user has actually completed (passed quiz) from StudySession records.
     * Returns an associative array: subject => [topic1, topic2, ...]
     */
    protected function getCompletedTopicsFromSessions(User $user, StudyPlan $plan): array
    {
        $sessions = $user->studySessions()
            ->where('study_plan_id', $plan->id)
            ->where('status', 'completed')
            ->get();

        $completed = [];
        foreach ($sessions as $session) {
            $meta = $session->meta ?? [];
            $subject = $meta['subject_name'] ?? null;
            $topic = $meta['topic_name'] ?? null;
            if ($subject && $topic) {
                $completed[$subject] = $completed[$subject] ?? [];
                if (! in_array($topic, $completed[$subject], true)) {
                    $completed[$subject][] = $topic;
                }
            }
        }

        return $completed;
    }

    /**
     * Get subjects whose end dates have passed (completed subjects).
     */
    public function getCompletedSubjects(User $user): array
    {
        $endDates = $user->subject_end_dates ?? [];
        $today = now();
        $completedSubjects = [];

        foreach ($endDates as $subject => $endDate) {
            if ($endDate) {
                $end = Carbon::parse($endDate);
                if ($end->lt($today)) {
                    $completedSubjects[] = $subject;
                }
            }
        }

        return $completedSubjects;
    }


    /**
     * Update completed session metadata to match new plan structure
     * This ensures completed sessions remain visible when plans are regenerated with different topics
     */
    public function preserveCompletedSessions(User $user, StudyPlan $newPlan, array $newSchedule): void
    {
        $completedSessions = $user->studySessions()
            ->where('status', 'completed')
            ->where('study_plan_id', $newPlan->id)
            ->get();

        foreach ($completedSessions as $session) {
            $sessionDate = Carbon::parse($session->started_at)->format('Y-m-d');
            $dayName = Carbon::parse($session->started_at)->format('l');
            
            // Find matching session in new schedule
            $matchingSession = $this->findMatchingSessionInSchedule(
                $session->meta->subject_name ?? '',
                $session->meta->topic_name ?? '',
                $sessionDate,
                $dayName,
                $newSchedule
            );

            if ($matchingSession) {
                // Update session metadata to match new plan's session structure
                $session->update([
                    'meta' => array_merge($session->meta ?? [], [
                        'subject_name' => $matchingSession['subject'],
                        'topic_name' => $matchingSession['topic'],
                        'original_subject' => $session->meta->subject_name ?? '',
                        'original_topic' => $session->meta->topic_name ?? '',
                        'preserved_from_plan_change' => true,
                    ])
                ]);
            }
        }
    }

    /**
     * Find a matching session in the new schedule based on subject and date
     */
    private function findMatchingSessionInSchedule(string $subject, string $topic, string $date, string $dayName, array $schedule): ?array
    {
        // Normalize for comparison
        $normalizeSubject = strtolower(trim(preg_replace('/[^a-z0-9\s]/', '', $subject)));
        $normalizeTopic = strtolower(trim(preg_replace('/[^a-z0-9\s]/', '', $topic)));

        // Check multiple possible schedule structures
        $daySchedule = null;
        
        // Try date-based first (YYYY-MM-DD format)
        if (isset($schedule[$date])) {
            $daySchedule = $schedule[$date];
        }
        // Try day name-based (Monday, Tuesday, etc.)
        elseif (isset($schedule[$dayName])) {
            $daySchedule = $schedule[$dayName];
        }
        // Try nested structure (schedule.weeks[].schedule)
        else {
            foreach ($schedule as $key => $value) {
                if ($key === 'weeks' && is_array($value)) {
                    foreach ($value as $week) {
                        if (isset($week['schedule'][$date])) {
                            $daySchedule = $week['schedule'][$date];
                            break 2;
                        } elseif (isset($week['schedule'][$dayName])) {
                            $daySchedule = $week['schedule'][$dayName];
                            break 2;
                        }
                    }
                }
            }
        }
        
        if (!$daySchedule || !isset($daySchedule['sessions'])) {
            return null;
        }

        foreach ($daySchedule['sessions'] as $session) {
            $sessionSubject = strtolower(trim(preg_replace('/[^a-z0-9\s]/', '', $session['subject'] ?? '')));
            $sessionTopic = strtolower(trim(preg_replace('/[^a-z0-9\s]/', '', $session['topic'] ?? '')));

            // Match subjects (allowing for variations)
            $subjectMatches = $sessionSubject === $normalizeSubject || 
                             str_contains($sessionSubject, $normalizeSubject) || 
                             str_contains($normalizeSubject, $sessionSubject);

            if (!$subjectMatches) continue;

            // Match topics (allowing for variations)
            $topicMatches = $sessionTopic === $normalizeTopic || 
                           str_contains($sessionTopic, $normalizeTopic) || 
                           str_contains($normalizeTopic, $sessionTopic) ||
                           $sessionTopic === 'study session' ||
                           $normalizeTopic === 'study session';

            // Enhanced semantic matching for tech topics
            $semanticMatch = false;
            if (!$topicMatches && $subjectMatches) {
                $techTerms = ['hook', 'state', 'effect', 'component', 'context', 'reducer'];
                foreach ($techTerms as $term) {
                    if (str_contains($sessionTopic, $term) && str_contains($normalizeTopic, $term)) {
                        $semanticMatch = true;
                        break;
                    }
                }
            }

            // Fallback for generic topics or very short topics
            $fallbackMatch = $subjectMatches && (
                $sessionTopic === 'study session' ||
                $normalizeTopic === 'study session' ||
                strlen($sessionTopic) < 3 ||
                strlen($normalizeTopic) < 3
            );

            if ($topicMatches || $semanticMatch || $fallbackMatch) {
                return $session;
            }
        }

        return null;
    }

    /**
     * Convert PlannerOutput (structured object) to an array for storage/logging.
     */
    protected function plannerOutputToArray(mixed $output): array
    {
        if ($output instanceof PlannerOutput) {
            return [
                'schedule' => $output->schedule ?? [],
                'strategy_summary' => $output->strategy_summary ?? '',
            ];
        }

        if (is_array($output)) {
            return $output;
        }

    }

    /**
     * Completely remove a subject from a user's world: Profile, LearningPaths, and StudyPlans.
     * 
     * @param bool $deepPurge If true, also deletes all historical StudySession records for this subject.
     */
    public function purgeSubject(User $user, string $subject, bool $deepPurge = false): void
    {
        $subject = trim($subject);
        $subjectLower = mb_strtolower($subject);

        // 1. Remove from User metadata
        $subjects = $user->subjects ?? [];
        $newSubjects = array_values(array_filter($subjects, fn($s) => mb_strtolower(trim($s)) !== $subjectLower));
        
        $diffs = $user->subject_difficulties ?? [];
        $starts = $user->subject_start_dates ?? [];
        $ends = $user->subject_end_dates ?? [];
        $durs = $user->subject_session_durations ?? [];

        // Case-insensitive removal for metadata maps
        $cleanupMap = function($map) use ($subjectLower) {
            if (!is_array($map)) return [];
            foreach ($map as $key => $val) {
                if (mb_strtolower(trim($key)) === $subjectLower) {
                    unset($map[$key]);
                }
            }
            return $map;
        };

        $user->update([
            'subjects' => $newSubjects,
            'subject_difficulties' => $cleanupMap($diffs),
            'subject_start_dates' => $cleanupMap($starts),
            'subject_end_dates' => $cleanupMap($ends),
            'subject_session_durations' => $cleanupMap($durs),
        ]);

        // 2. Handle LearningPaths and optional Deep Purge of Sessions
        $pathsQuery = $user->learningPaths()
            ->whereRaw('LOWER(subject_name) = ?', [$subjectLower]);
        
        if ($deepPurge) {
            $pathIds = $pathsQuery->pluck('id')->toArray();
            if (!empty($pathIds)) {
                // Delete all sessions linked to these historical paths
                $user->studySessions()
                    ->whereIn('learning_path_id', $pathIds)
                    ->delete();
                
                // Also attempt to find sessions matching subject in meta (fallback for old data)
                // This is less efficient but ensures parity if learning_path_id was null
                $user->studySessions()
                    ->whereNull('learning_path_id')
                    ->whereRaw("LOWER(JSON_UNQUOTE(JSON_EXTRACT(meta, '$.subject'))) = ?", [$subjectLower])
                    ->delete();
            }
        }

        // Delete ALL learning paths for this subject (active or completed)
        $pathsQuery->delete();

        // 3. Scrub from all active/archived StudyPlans (JSON generated_plan)
        $plans = $user->studyPlans()->whereIn('status', ['active', 'archived'])->get();
        foreach ($plans as $plan) {
            $this->removeSubjectFromPlan($plan, $subject);
        }

        \Log::info("Purged subject '{$subject}' for user {$user->id}" . ($deepPurge ? " (including history)" : ""));
    }

    /**
     * Remove all sessions for a specific subject from a StudyPlan's JSON schedule.
     */
    public function removeSubjectFromPlan(StudyPlan $plan, string $subject): void
    {
        $gp = $plan->generated_plan;
        if (!is_array($gp)) return;

        $subjectLower = mb_strtolower(trim($subject));

        // Helper to filter sessions from a schedule array
        $filterSessions = function($schedule) use ($subjectLower) {
            if (!is_array($schedule)) return $schedule;
            foreach ($schedule as $day => $data) {
                if (isset($data['sessions']) && is_array($data['sessions'])) {
                    $schedule[$day]['sessions'] = array_values(array_filter($data['sessions'], function($s) use ($subjectLower) {
                        return mb_strtolower(trim($s['subject'] ?? '')) !== $subjectLower;
                    }));
                }
            }
            return $schedule;
        };

        // Scrub main schedule
        if (isset($gp['schedule'])) {
            $gp['schedule'] = $filterSessions($gp['schedule']);
        }

        // Scrub weeks array
        if (isset($gp['weeks']) && is_array($gp['weeks'])) {
            foreach ($gp['weeks'] as $idx => $week) {
                if (isset($week['schedule'])) {
                    $gp['weeks'][$idx]['schedule'] = $filterSessions($week['schedule']);
                }
            }
        }

        $plan->update(['generated_plan' => $gp]);
    }
}
