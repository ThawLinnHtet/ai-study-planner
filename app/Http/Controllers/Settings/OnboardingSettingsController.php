<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Services\StudyHoursValidator;
use App\Services\StudyPlanService;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class OnboardingSettingsController extends Controller
{
    protected StudyPlanService $studyPlanService;
    protected \App\Services\LearningPathService $learningPathService;
    protected \App\Services\UserProgressService $userProgressService;

    public function __construct(
        StudyPlanService $studyPlanService,
        \App\Services\LearningPathService $learningPathService,
        \App\Services\UserProgressService $userProgressService
    ) {
        $this->studyPlanService = $studyPlanService;
        $this->learningPathService = $learningPathService;
        $this->userProgressService = $userProgressService;
    }

    /**
     * Show the onboarding settings page.
     */
    public function edit(Request $request): Response
    {
        // Force fresh user data from database
        $user = $request->user()->fresh();

        return Inertia::render('settings/onboarding-settings', [
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'subjects' => $user->subjects ?? [],
                'subject_difficulties' => $user->subject_difficulties ?? [],
                'subject_session_durations' => $user->subject_session_durations ?? [],
                'subject_start_dates' => $user->subject_start_dates ?? [],
                'subject_end_dates' => $user->subject_end_dates ?? [],
                'daily_study_hours' => $user->daily_study_hours,
                'study_goal' => $user->study_goal,
                'timezone' => $user->timezone,
                'onboarding_completed' => $user->onboarding_completed,
                'onboarding_step' => $user->onboarding_step,
                'is_generating_plan' => $user->is_generating_plan,
                'generating_status' => $user->generating_status,
            ],
            'activePlan' => $user->studyPlans()
                ->where('status', 'active')
                ->first(),
            'activeEnrollments' => $this->learningPathService->getActiveLearningPaths($user),
        ]);
    }

    /**
     * Update the onboarding settings.
     */
    public function update(Request $request): RedirectResponse
    {
        // Regenerating plans may take longer than the default 60s limit
        // (AI calls + curriculum sync). Align timeout with onboarding flow.
        set_time_limit(180);

        $user = $request->user();

        $validated = $request->validate([
            'subjects' => ['required', 'array', 'min:1', 'max:6'],
            'subjects.*' => ['required', 'string', 'max:255'],
            'subject_difficulties' => ['nullable', 'array'],
            'subject_difficulties.*' => ['nullable', 'integer', 'min:1', 'max:3'],
            'subject_session_durations' => ['nullable', 'array'],
            'subject_session_durations.*.min' => ['nullable', 'integer', 'min:15', 'max:240'],
            'subject_session_durations.*.max' => ['nullable', 'integer', 'min:15', 'max:240'],
            'daily_study_hours' => ['required', 'integer', 'min:1', 'max:6'],
            'study_goal' => ['required', 'string', 'min:3', 'max:255'],
            'timezone' => ['nullable', 'string', 'timezone:all'],
            'regenerate_plan' => ['nullable', 'boolean'],
            'subject_start_dates' => ['required', 'array'],
            'subject_start_dates.*' => ['required', 'date'],
            'subject_end_dates' => ['required', 'array'],
            'subject_end_dates.*' => ['required', 'date'],
        ], [
            'subjects.required' => 'Please select at least one subject.',
            'daily_study_hours.min' => 'Study time must be at least 1 hour per day.',
            'daily_study_hours.max' => 'Study time cannot exceed 6 hours per day for optimal learning.',
            'subject_start_dates.*.required' => 'Please select a start date for every subject.',
            'subject_end_dates.*.required' => 'Please select an end date for every subject.',
        ]);

        $startDates = $validated['subject_start_dates'];
        $endDates = $validated['subject_end_dates'];

        // Helper for case-insensitive lookup
        $ciLookup = function (array $map, string $key): ?string {
            if (isset($map[$key])) return $map[$key];
            foreach ($map as $k => $v) {
                if (mb_strtolower($k) === mb_strtolower($key)) return $v;
            }
            return null;
        };

        // Normalize subjects, dates and difficulties
        $subjects = collect($validated['subjects'])
            ->map(fn($s) => trim($s))
            ->unique(fn($s) => mb_strtolower($s, 'UTF-8'))
            ->values()
            ->all();

        $normalizedStartDates = [];
        $normalizedEndDates = [];
        $normalizedDifficulties = [];
        $rawStartDates = $validated['subject_start_dates'];
        $rawEndDates = $validated['subject_end_dates'];
        $rawDifficulties = $validated['subject_difficulties'] ?? [];

        foreach ($subjects as $subject) {
            $normalizedStartDates[$subject] = $ciLookup($rawStartDates, $subject);
            $normalizedEndDates[$subject] = $ciLookup($rawEndDates, $subject);
            
            $diff = $rawDifficulties[$subject] ?? null;
            if ($diff === null) {
                foreach ($rawDifficulties as $k => $v) {
                    if (mb_strtolower($k) === mb_strtolower($subject)) {
                        $diff = $v;
                        break;
                    }
                }
            }
            $normalizedDifficulties[$subject] = $diff ?? 2;
        }

        foreach ($subjects as $subject) {
            $start = $normalizedStartDates[$subject];
            $end = $normalizedEndDates[$subject];

            if (!$start || !$end) {
                return back()->withErrors([
                    'subject_dates' => 'Please select start and end dates for every subject.',
                ])->withInput();
            }

            if (Carbon::parse($start)->gt(Carbon::parse($end))) {
                return back()->withErrors([
                    'subject_dates' => 'Start date must be before end date for every subject.',
                ])->withInput();
            }
        }

        // Use the new WorkloadAnalyzer for perfection-grade validation
        $analyzer = app(\App\Services\WorkloadAnalyzer::class);
        $analysis = $analyzer->analyze(
            (int) $validated['daily_study_hours'],
            $subjects,
            $normalizedDifficulties,
            $normalizedStartDates,
            $normalizedEndDates
        );

        if (!$analysis['is_realistic'] && !empty($analysis['warnings'])) {
            session()->flash('onboarding_warning', [
                'title' => 'Sustainability Safeguard',
                'description' => $analysis['has_duration_error'] 
                    ? 'We found some issues with your subject dates. Please adjust them to continue.'
                    : 'Your workload looks quite intense! You can proceed, but we recommend checking our tips below.',
                'message' => $analysis['warnings'],
                'recommendations' => $analysis['recommendations']
            ]);
            
            if ($analysis['has_duration_error']) {
                return back()->withInput();
            }
        }

        // Update user settings normalization
        $existingDurations = $user->subject_session_durations ?? [];
        $incomingDurations = $validated['subject_session_durations'] ?? [];

        // Pre-normalize duration maps to handle casing inconsistencies between FE/DB
        $normalizeDurationMap = function(array $map) {
            $normalized = [];
            foreach ($map as $key => $value) {
                if (is_array($value)) {
                    $normalized[mb_strtolower($key, 'UTF-8')] = $value;
                }
            }
            return $normalized;
        };

        $normalizedIncoming = $normalizeDurationMap($incomingDurations);
        $normalizedExisting = $normalizeDurationMap($existingDurations);

        $normalizedDurations = [];
        foreach ($subjects as $subject) {
            $sKey = mb_strtolower($subject, 'UTF-8');
            $incoming = $normalizedIncoming[$sKey] ?? null;
            $existing = $normalizedExisting[$sKey] ?? null;
            
            // Merge properties: incoming takes precedence
            $duration = array_merge($existing ?? [], $incoming ?? []);

            // Ensure we have both min and max if we're saving anything
            if (isset($duration['min']) && isset($duration['max'])) {
                $min = max(15, min(240, (int) $duration['min']));
                $max = max(15, min(240, (int) $duration['max']));

                $normalizedDurations[$subject] = [
                    'min' => min($min, $max),
                    'max' => max($min, $max),
                ];
            }
        }

        // Conflict Detection: Ensure Σ(min_duration) <= daily_study_hours * 60
        $totalMinMinutes = collect($normalizedDurations)->sum('min');
        $dailyLimitMinutes = ((int) ($validated['daily_study_hours'] ?: 2)) * 60;

        if ($totalMinMinutes > $dailyLimitMinutes) {
            $hours = floor($totalMinMinutes / 60);
            $remainingMin = $totalMinMinutes % 60;
            $formattedTotal = $remainingMin === 0 ? "{$hours}h" : "{$hours}h {$remainingMin}min";
            $dailyLimit = $validated['daily_study_hours'] ?: 2;

            session()->flash('onboarding_warning', [
                'title' => 'Sustainability Safeguard',
                'message' => "With your current settings and default task lengths, you need at least {$formattedTotal}, which exceeds your daily study limit of {$dailyLimit}h.",
                'recommendations' => [
                    "Shorten some of your custom sessions or set shorter ones for others.",
                    "Decrease your daily study hours if you have less time.",
                    "Remove a subject to reduce the daily load."
                ]
            ]);
            return back()->withInput();
        }

        // Update user settings
        $oldSubjects = $user->subjects ?? [];
        $oldDailyHours = $user->daily_study_hours;
        $oldSessionDurations = $user->subject_session_durations ?? [];
        $oldStartDates = $user->subject_start_dates ?? [];
        $oldEndDates = $user->subject_end_dates ?? [];
        $oldDifficulties = $user->subject_difficulties ?? [];


        $user->update([
            'subjects' => $subjects,
            'subject_difficulties' => $normalizedDifficulties,
            'subject_session_durations' => $normalizedDurations,
            'subject_start_dates' => $normalizedStartDates,
            'subject_end_dates' => $normalizedEndDates,
            'daily_study_hours' => $validated['daily_study_hours'],
            'study_goal' => $validated['study_goal'],
            'timezone' => $validated['timezone'],
        ]);

        // Verify the data was actually saved
        $user->refresh();

        // Cleanup removed subjects (Synchronous but fast)
        // MUST happen before AI regeneration and always, regardless of $needsRegeneration
        $subjectsToRemove = array_diff($oldSubjects, $subjects);
        foreach ($subjectsToRemove as $removedSubject) {
            try {
                $this->studyPlanService->purgeSubject($user, $removedSubject);
            } catch (\Exception $e) {
                \Log::warning("Could not purge subject {$removedSubject}: " . $e->getMessage());
            }
        }

        // Detect EXACTLY what changed to avoid redundant AI generation
        $isGlobalChange = (
            $oldDailyHours !== (int) $validated['daily_study_hours'] ||
            mb_strtolower($user->study_goal ?? '') !== mb_strtolower($validated['study_goal']) ||
            $user->timezone !== ($validated['timezone'] ?? null)
        );

        $subjectsToRegenerate = [];
        foreach ($subjects as $subject) {
            $hasSubjectSpecificChange = (
                !in_array($subject, $oldSubjects) ||
                ($oldStartDates[$subject] ?? null) !== $normalizedStartDates[$subject] ||
                ($oldEndDates[$subject] ?? null) !== $normalizedEndDates[$subject] ||
                ($oldDifficulties[$subject] ?? null) !== $normalizedDifficulties[$subject]
            );

            if ($isGlobalChange || $hasSubjectSpecificChange) {
                $subjectsToRegenerate[$subject] = [
                    'start_date' => $normalizedStartDates[$subject],
                    'end_date' => $normalizedEndDates[$subject],
                    'difficulty' => $normalizedDifficulties[$subject] ?? 2,
                ];
            }
        }

        // Only regenerate if truly necessary or explicitly requested
        $needsRegeneration = !empty($subjectsToRegenerate) || ($validated['regenerate_plan'] ?? false);
        $minorChangesDetected = ($oldSessionDurations !== $normalizedDurations);

        // Regenerate study plan if requested or when core settings changed
        if ($needsRegeneration) {
            // Mark user as generating
            $user->update([
                'is_generating_plan' => true,
                'generating_status' => 'Crafting your personalized study journey...'
            ]);

            // Refresh user to get the latest saved data
            $user->refresh();


            \App\Jobs\GenerateParallelCurriculaJob::dispatch($user, $subjectsToRegenerate);

            return redirect()->route('study-planner')
                ->with('success', 'Your study preferences have been updated! We are regenerating your personalized study plan in the background.');
        } elseif ($minorChangesDetected) {
            \App\Jobs\FinalizeStudyPlanJob::dispatch($user);
            return redirect()->route('study-planner')
                ->with('success', 'Your schedule has been optimized based on your updated session preferences.');
        }

        // Only minor settings changed (like session durations, difficulties, etc.)
        // No plan regeneration needed - preferences saved silently
        session()->flash('success', 'Your study preferences have been updated!');
        return redirect()->route('onboarding-settings.edit');
    }

    /**
     * Reset onboarding and start over.
     */
    public function reset(Request $request): RedirectResponse
    {
        $user = $request->user();

        // Reset onboarding progress
        $user->update([
            'onboarding_step' => 1,
            'onboarding_completed' => false,
            'subjects' => null,
            'subject_difficulties' => null,
            'daily_study_hours' => null,
            'study_goal' => null,
            'timezone' => null,
        ]);

        // Deactivate current study plan
        $user->studyPlans()
            ->where('status', 'active')
            ->update(['status' => 'inactive']);

        return redirect('/onboarding')
            ->with('info', 'Your onboarding has been reset. Let\'s set up your study preferences again!');
    }
}
