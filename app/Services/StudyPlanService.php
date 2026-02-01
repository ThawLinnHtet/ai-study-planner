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
            'daily_study_hours' => $user->daily_study_hours,
            'productivity_peak' => $user->productivity_peak,
            'learning_style' => $user->learning_style,
            'study_goal' => $user->study_goal,
            'current_day' => Carbon::today()->format('l'),
            'current_date' => Carbon::today()->toDateString(),
        ];

        $output = $this->neuron->planner()->createPlan($data);

        return DB::transaction(function () use ($user, $output) {
            // Deactivate any existing active plans
            $user->studyPlans()->where('status', 'active')->update(['status' => 'archived']);

            $startsOn = Carbon::today();
            $endsOn = $this->resolvePlanEndDate($user->exam_dates, $startsOn);

            $normalized = $this->normalizeGeneratedPlan((array) $output);
            $normalized['weeks'] = [
                [
                    'week_start' => $startsOn->toDateString(),
                    'schedule' => $normalized['schedule'],
                ],
            ];

            return StudyPlan::create([
                'user_id' => $user->id,
                'title' => 'Initial Strategic Plan',
                'goal' => $user->study_goal,
                'starts_on' => $startsOn,
                'ends_on' => $endsOn,
                'target_hours_per_week' => $user->daily_study_hours * 7,
                'status' => 'active',
                'preferences' => [
                    'productivity_peak' => $user->productivity_peak,
                    'learning_style' => $user->learning_style,
                ],
                'generated_plan' => $normalized,
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
                $out[] = [
                    'subject' => (string) ($s['subject'] ?? 'Study Session'),
                    'topic' => (string) ($s['topic'] ?? ''),
                    'duration_minutes' => $this->parseDuration($s['duration_minutes'] ?? $s['duration'] ?? null),
                    'focus_level' => in_array($s['focus_level'] ?? '', ['low', 'medium', 'high'], true)
                        ? $s['focus_level']
                        : 'medium',
                ];
                continue;
            }
            if (is_string($s)) {
                $trimmed = trim($s);
                // If AI returned a JSON string, parse it into a session object
                if (str_starts_with($trimmed, '{')) {
                    $decoded = json_decode($trimmed, true);
                    if (is_array($decoded) && isset($decoded['subject'])) {
                        $out[] = [
                            'subject' => (string) ($decoded['subject'] ?? 'Study Session'),
                            'topic' => (string) ($decoded['topic'] ?? ''),
                            'duration_minutes' => $this->parseDuration($decoded['duration_minutes'] ?? $decoded['duration'] ?? null),
                            'focus_level' => in_array($decoded['focus_level'] ?? '', ['low', 'medium', 'high'], true)
                                ? $decoded['focus_level']
                                : 'medium',
                        ];
                        continue;
                    }
                }
                $out[] = [
                    'subject' => trim(explode(':', $trimmed)[0] ?? 'Study Session'),
                    'topic' => $trimmed,
                    'duration_minutes' => 60,
                    'focus_level' => 'medium',
                ];
                continue;
            }
        }
        return $out;
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
