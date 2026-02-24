<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\StudyHoursValidator;
use App\Services\StudyPlanService;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class OnboardingController extends Controller
{
    private const TOTAL_STEPS = 4;
    public const DEFAULT_SESSION_MIN = 30;
    public const DEFAULT_SESSION_MAX = 90;

    protected StudyPlanService $studyPlanService;
    protected \App\Services\LearningPathService $learningPathService;
    protected \App\Services\WorkloadAnalyzer $workloadAnalyzer;

    public function __construct(
        StudyPlanService $studyPlanService,
        \App\Services\LearningPathService $learningPathService,
        \App\Services\WorkloadAnalyzer $workloadAnalyzer
    ) {
        $this->studyPlanService = $studyPlanService;
        $this->learningPathService = $learningPathService;
        $this->workloadAnalyzer = $workloadAnalyzer;
    }

    public function show(Request $request): Response
    {
        $user = $request->user();

        $maxStep = (int) ($user->onboarding_step ?? 1);
        $maxStep = max(1, min(self::TOTAL_STEPS, $maxStep));

        $requestedStep = $request->integer('step');

        $step = $requestedStep && $requestedStep <= $maxStep
            ? $requestedStep
            : $maxStep;

        return Inertia::render('onboarding/index', [
            'step' => $step,
            'totalSteps' => self::TOTAL_STEPS,
            'onboarding' => [
                'subjects' => $user->subjects ?? [],
                'subject_difficulties' => $user->subject_difficulties ?? [],
                'subject_session_durations' => $user->subject_session_durations ?? [],
                'daily_study_hours' => $user->daily_study_hours,
                'study_goal' => $user->study_goal,
                'timezone' => $user->timezone,
                'subject_start_dates' => $user->subject_start_dates ?? [],
                'subject_end_dates' => $user->subject_end_dates ?? [],
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        set_time_limit(180); // Increase timeout for complex setup
        $user = $request->user();

        $validated = $request->validate([
            'step' => ['required', 'integer', 'min:1', 'max:'.self::TOTAL_STEPS],
        ]);

        $step = (int) $validated['step'];

        if ($step === 1) {
            $data = $request->validate([
                'subjects' => ['required', 'array', 'min:1', 'max:6'],
                'subjects.*' => ['required', 'string', 'min:3', 'max:100'],
            ], [
                'subjects.max' => 'Focus Six: You can select a maximum of 6 subjects for optimal learning depth.',
                'subjects.*.min' => 'Subject names must be at least 3 characters long for high-quality AI generation.',
            ]);

            $subjects = collect($data['subjects'])
                ->map(fn (string $s) => trim($s))
                ->filter(fn (string $s) => $s !== '')
                // Filter out subjects that are only numbers or special characters
                ->filter(fn (string $s) => preg_match('/[a-zA-Z]/', $s))
                // Normalize to Title Case for Neuron AI
                ->map(fn (string $s) => mb_convert_case($s, MB_CASE_TITLE, 'UTF-8'))
                // Remove duplicates (case-insensitive)
                ->unique(fn (string $s) => mb_strtolower($s, 'UTF-8'))
                ->values()
                ->all();

            if (empty($subjects)) {
                return back()->withErrors([
                    'subjects' => 'Please add at least one valid subject.',
                ]);
            }

            // Also validate daily hours and study goal in step 1
            $hoursData = $request->validate([
                'daily_study_hours' => ['required', 'integer', 'min:1', 'max:6'],
                'study_goal' => ['required', 'string', 'min:3', 'max:255'],
            ]);

            $dailyHours = $hoursData['daily_study_hours'] ?? 2;
            $validation = StudyHoursValidator::validateAndAdjust($dailyHours);

            if (!$validation['is_realistic']) {
                return back()
                    ->withErrors([
                        'daily_study_hours' => 'Study time of '.$dailyHours.' hours exceeds recommended limits. For optimal learning, please choose 1-6 hours per day.',
                    ])
                    ->withInput();
            }

            $user->forceFill([
                'subjects' => $subjects,
                'daily_study_hours' => $validation['recommended_hours'],
                'study_goal' => $hoursData['study_goal'],
                'onboarding_step' => max((int) ($user->onboarding_step ?? 1), 2),
            ])->save();

            return redirect('/onboarding');
        }

        if ($step === 2) {
            $data = $request->validate([
                'subjects' => ['required', 'array', 'min:1', 'max:6'],
                'subjects.*' => ['required', 'string', 'min:2', 'max:100'],
                'subject_difficulties' => ['nullable', 'array'],
                'subject_difficulties.*' => ['nullable', 'integer', 'min:1', 'max:3'],
                'subject_session_durations' => ['nullable', 'array'],
                'subject_session_durations.*.min' => ['nullable', 'integer', 'min:15', 'max:240'],
                'subject_session_durations.*.max' => ['nullable', 'integer', 'min:15', 'max:240'],
                'subject_start_dates' => ['required', 'array'],
                'subject_start_dates.*' => ['required', 'date'],
                'subject_end_dates' => ['required', 'array'],
                'subject_end_dates.*' => ['required', 'date'],
            ], [
                'subject_start_dates.*.required' => 'Please select a start date for every subject.',
                'subject_end_dates.*.required' => 'Please select an end date for every subject.',
            ]);

            // Process subjects from current form data (not database)
            $subjects = collect($data['subjects'])
                ->map(fn (string $s) => trim($s))
                ->filter(fn (string $s) => $s !== '')
                ->filter(fn (string $s) => preg_match('/[a-zA-Z]/', $s))
                ->map(fn (string $s) => mb_convert_case($s, MB_CASE_TITLE, 'UTF-8'))
                ->unique(fn (string $s) => mb_strtolower($s, 'UTF-8'))
                ->values()
                ->all();

            $rawStartDates = $data['subject_start_dates'] ?? [];
            $rawEndDates = $data['subject_end_dates'] ?? [];

            // Build case-insensitive lookup for dates (keys from frontend may differ in case from Title-Cased subjects)
            $ciLookup = function (array $map, string $key): ?string {
                if (isset($map[$key])) return $map[$key];
                foreach ($map as $k => $v) {
                    if (mb_strtolower($k) === mb_strtolower($key)) return $v;
                }
                return null;
            };

            // Ensure every subject has both dates and start precedes end
            $subjectsWithMissingDates = collect($subjects)->filter(fn ($subject) => empty($ciLookup($rawStartDates, $subject)) || empty($ciLookup($rawEndDates, $subject)));
            if ($subjectsWithMissingDates->isNotEmpty()) {
                return back()->withErrors([
                    'subject_dates' => 'Please select start and end dates for every subject.',
                ])->withInput();
            }

            $subjectsWithInvalidRange = collect($subjects)->filter(function ($subject) use ($rawStartDates, $rawEndDates, $ciLookup) {
                $start = $ciLookup($rawStartDates, $subject);
                $end = $ciLookup($rawEndDates, $subject);
                return $start && $end && Carbon::parse($start)->gt(Carbon::parse($end));
            });
            if ($subjectsWithInvalidRange->isNotEmpty()) {
                return back()->withErrors([
                    'subject_dates' => 'Start date must be before end date for every subject.',
                ])->withInput();
            }

            // Build case-insensitive lookup for difficulties and session durations
            $ciLookupAny = function (array $map, string $key) {
                if (isset($map[$key])) return $map[$key];
                foreach ($map as $k => $v) {
                    if (mb_strtolower($k) === mb_strtolower($key)) return $v;
                }
                return null;
            };

            $difficulties = [];
            foreach ($subjects as $subject) {
                $diff = $ciLookupAny($data['subject_difficulties'] ?? [], $subject);
                if ($diff !== null && is_numeric($diff)) {
                    $difficulties[$subject] = (int) max(1, min(3, (int) $diff));
                }
            }

            // Merge new session durations with existing ones from DB
            $existingDurations = $user->subject_session_durations ?? [];
            $newDurations = [];
            foreach ($subjects as $subject) {
                $dur = $ciLookupAny($data['subject_session_durations'] ?? [], $subject);
                if ($dur && ($dur['min'] ?? null) && ($dur['max'] ?? null)) {
                    $newDurations[$subject] = $dur;
                }
            }
            $mergedDurations = array_merge($existingDurations, $newDurations);
            // Remove subjects no longer in the list
            $mergedDurations = array_filter($mergedDurations, fn($dur, $key) => in_array($key, $subjects), ARRAY_FILTER_USE_BOTH);

            // Normalize date keys to match Title-Cased subjects
            $normalizedStartDates = [];
            $normalizedEndDates = [];
            foreach ($subjects as $subject) {
                $normalizedStartDates[$subject] = $ciLookup($rawStartDates, $subject);
                $normalizedEndDates[$subject] = $ciLookup($rawEndDates, $subject);
            }

            // Base data saving
            $user->forceFill([
                'subjects' => $subjects,
                'subject_difficulties' => $difficulties,
                'subject_start_dates' => $normalizedStartDates,
                'subject_end_dates' => $normalizedEndDates,
            ])->save();

            // Run Workload Analysis for Perfection-Grade Validation
            $analysis = $this->workloadAnalyzer->analyze(
                $user->daily_study_hours ?: 2,
                $subjects,
                $difficulties,
                $normalizedStartDates,
                $normalizedEndDates
            );

            if (!$analysis['is_realistic'] && !empty($analysis['warnings'])) {
                session()->flash('onboarding_warning', [
                    'title' => 'Sustainability Safeguard',
                    'message' => $analysis['warnings'], // Send all warnings
                    'recommendations' => $analysis['recommendations']
                ]);
                
                return back();
            }

            // If realistic, advance to Step 3
            $user->forceFill([
                'onboarding_step' => max((int) ($user->onboarding_step ?? 1), 3),
            ])->save();

            return redirect('/onboarding');
        }

        if ($step === 3) {
            // Step 3: Session durations (optional) and timezone
            $data = $request->validate([
                'timezone' => ['required', 'string', 'timezone:all'], // Now required
                'subject_session_durations' => ['nullable', 'array'],
                'subject_session_durations.*.min' => ['nullable', 'integer', 'min:15', 'max:120'],
                'subject_session_durations.*.max' => ['nullable', 'integer', 'min:15', 'max:120'],
            ]);

            $timezone = $data['timezone'] ?? null;
            if ($timezone === 'Asia/Rangoon') {
                $timezone = 'Asia/Yangon';
            }

            // Merge new durations with existing ones from DB (step 2 may have saved some)
            $existingDurations = $user->subject_session_durations ?? [];
            
            \Log::info('Step 3 - Received subject_session_durations:', $data['subject_session_durations'] ?? []);
            \Log::info('Step 3 - Existing durations from DB:', $existingDurations);
            \Log::info('Step 3 - User subjects:', $user->subjects ?? []);
            
            $newDurations = collect($data['subject_session_durations'] ?? [])
                ->filter(function ($dur, $subject) use ($user) {
                    $subjects = $user->subjects ?? [];
                    $hasMin = ($dur['min'] ?? null) !== null;
                    $hasMax = ($dur['max'] ?? null) !== null;
                    $inSubjects = in_array($subject, $subjects);
                    
                    \Log::info("Filtering {$subject}: inSubjects={$inSubjects}, hasMin={$hasMin}, hasMax={$hasMax}", ['dur' => $dur]);
                    
                    return $inSubjects && $hasMin && $hasMax;
                })
                ->all();

            \Log::info('Step 3 - Filtered new durations:', $newDurations);

            // Merge: new values override existing, but existing are preserved if not sent
            $mergedDurations = array_merge($existingDurations, $newDurations);
            // Remove any subjects no longer in the user's subject list
            $subjects = $user->subjects ?? [];
            $mergedDurations = array_filter($mergedDurations, fn($dur, $key) => in_array($key, $subjects), ARRAY_FILTER_USE_BOTH);
            
            \Log::info('Step 3 - Final merged durations to save:', $mergedDurations);
            
            // Calculate total time including DEFAULTS for subjects not yet set
            $subjects = $user->subjects ?? [];
            $totalProjectedMinutes = 0;
            
            foreach ($subjects as $subject) {
                if (isset($mergedDurations[$subject])) {
                    $totalProjectedMinutes += $mergedDurations[$subject]['min'];
                } else {
                    // This subject was skipped, so it will use the default
                    $totalProjectedMinutes += self::DEFAULT_SESSION_MIN;
                }
            }

            $dailyLimitMinutes = ($user->daily_study_hours ?: 2) * 60;

            if ($totalProjectedMinutes > $dailyLimitMinutes) {
                $hours = floor($totalProjectedMinutes / 60);
                $remainingMin = $totalProjectedMinutes % 60;
                $formattedTotal = $remainingMin === 0 ? "{$hours}h" : "{$hours}h {$remainingMin}min";
                $dailyLimit = $user->daily_study_hours ?: 2;

                session()->flash('onboarding_warning', [
                    'title' => 'Sustainability Safeguard',
                    'message' => "With your current settings and default task lengths, you need at least {$formattedTotal}, which exceeds your daily limit of {$dailyLimit}h.",
                    'recommendations' => [
                        "Shorten some of your custom sessions or set shorter ones for others.",
                        "Go back to Step 1 and increase your daily study hours.",
                        "Remove a subject to reduce the daily load."
                    ]
                ]);
                return back();
            }

            $user->forceFill([
                'timezone' => $timezone,
                'subject_session_durations' => $mergedDurations,
                'onboarding_step' => max((int) ($user->onboarding_step ?? 1), 4),
            ])->save();

            return redirect('/onboarding');
        }

        $request->validate([
            'confirm' => ['required', 'boolean', 'accepted'],
        ], [
            'confirm.accepted' => 'Please confirm that your details are correct before finishing.',
        ]);

        $user->forceFill([
            'onboarding_completed' => true,
            'onboarding_step' => self::TOTAL_STEPS,
            'is_generating_plan' => true,
            'generating_status' => 'Preparing your study journey...',
        ])->save();

        if ($user->subjects && is_array($user->subjects)) {
            $timezone = $user->timezone ?? config('app.timezone');
            $subjectsData = [];
            
            foreach ($user->subjects as $subject) {
                $subjectsData[$subject] = [
                    'start_date' => $user->subject_start_dates[$subject],
                    'end_date' => $user->subject_end_dates[$subject],
                    'difficulty' => $user->subject_difficulties[$subject] ?? 2,
                ];
            }

            \App\Jobs\GenerateParallelCurriculaJob::dispatch($user, $subjectsData);
        } else {
            $user->update(['is_generating_plan' => false]);
        }

        return redirect()->route('dashboard');
    }

    /**
     * Create a fallback study plan when AI generation fails.
     */
    private function createFallbackPlan(User $user): void
    {
        $subjects = $user->subjects ?? [];
        if (is_string($subjects)) {
            $subjects = json_decode($subjects, true) ?? [];
        }
        $dailyHours = $user->daily_study_hours ?? 2;
        $startDates = $user->subject_start_dates ?? [];
        $endDates = $user->subject_end_dates ?? [];

        if (empty($subjects) || ! is_array($subjects)) {
            return;
        }

        // Determine which subjects are active today
        $timezone = $user->timezone ?? config('app.timezone');
        $today = Carbon::now($timezone)->startOfDay();
        $activeSubjects = array_filter($subjects, function ($subject) use ($startDates, $endDates, $today, $timezone) {
            $start = Carbon::parse($startDates[$subject], $timezone);
            $end = Carbon::parse($endDates[$subject], $timezone);
            return $today->gte($start) && $today->lte($end);
        });
        $activeSubjects = array_values($activeSubjects);

        if (empty($activeSubjects)) {
            $activeSubjects = $subjects; // Fallback to all subjects
        }

        // Build beginner→advanced topic labels per subject based on date progress
        // Uses SubjectCurriculumTemplates for subject-specific topics
        $topicCounters = []; // Track which topic index to use per subject per difficulty tier
        $getTopicLabel = function (string $subject, int $dayOffset) use ($startDates, $endDates, $today, $timezone, &$topicCounters) {
            $start = Carbon::parse($startDates[$subject], $timezone);
            $end = Carbon::parse($endDates[$subject], $timezone);
            $totalDays = max(1, $start->diffInDays($end) + 1);
            $elapsed = max(0, $start->diffInDays($today)) + $dayOffset;
            $progress = $elapsed / $totalDays;

            if ($progress <= 0.3) {
                $tier = 'beginner';
            } elseif ($progress <= 0.7) {
                $tier = 'intermediate';
            } else {
                $tier = 'advanced';
            }

            $topics = \App\Services\SubjectCurriculumTemplates::getTopicsForSubject($subject);
            $tierTopics = $topics[$tier] ?? [];

            if (empty($tierTopics)) {
                return "{$subject} - Study Session";
            }

            $key = $subject . '::' . $tier;
            if (!isset($topicCounters[$key])) {
                $topicCounters[$key] = 0;
            }
            $index = $topicCounters[$key] % count($tierTopics);
            $topicCounters[$key]++;

            return $tierTopics[$index];
        };

        $schedule = [];
        $days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

        foreach ($days as $dayIndex => $day) {
            $daySessions = [];
            $subjectIndex = 0;
            $remainingMinutes = $dailyHours * 60;

            while ($remainingMinutes > 30 && $subjectIndex < count($activeSubjects)) {
                $sessionMinutes = min(90, $remainingMinutes);
                $subject = $activeSubjects[$subjectIndex];

                // Respect custom session durations if set
                $sessionDurations = $user->subject_session_durations ?? [];
                if (isset($sessionDurations[$subject])) {
                    $min = $sessionDurations[$subject]['min'] ?? 30;
                    $max = $sessionDurations[$subject]['max'] ?? 90;
                    $sessionMinutes = min($max, max($min, $sessionMinutes));
                }

                $daySessions[] = [
                    'subject' => $subject,
                    'topic' => $getTopicLabel($subject, $dayIndex),
                    'duration_minutes' => $sessionMinutes,
                    'focus_level' => 'medium',
                ];

                $remainingMinutes -= $sessionMinutes;
                $subjectIndex = ($subjectIndex + 1) % count($activeSubjects);
            }

            $schedule[$day] = ['sessions' => $daySessions];
        }

        // Resolve plan end date from subject end dates
        $endsOn = $today->copy()->addDays(29);
        if (!empty($endDates)) {
            $farthest = collect($endDates)->filter()->map(fn ($d) => Carbon::parse($d, $timezone))->max();
            if ($farthest && $farthest->gt($today)) {
                $endsOn = $farthest;
            }
        }

        \App\Models\StudyPlan::create([
            'user_id' => $user->id,
            'title' => 'Study Plan',
            'goal' => $user->study_goal ?? 'General Study Improvement',
            'starts_on' => $today,
            'ends_on' => $endsOn,
            'target_hours_per_week' => $dailyHours * 7,
            'status' => 'active',
            'generated_plan' => [
                'schedule' => $schedule,
                'strategy_summary' => 'Basic study plan created to help you get started. You can refine this with AI recommendations later.',
                'weeks' => [
                    [
                        'week_start' => $today->toDateString(),
                        'schedule' => $schedule,
                    ],
                ],
            ],
        ]);
    }

    public function storeSubjects(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'subjects' => ['required', 'array', 'min:1'],
            'subjects.*' => ['required', 'string', 'max:255'],
        ]);

        $user = $request->user();

        // Store subjects in user's onboarding data
        $user->update([
            'subjects' => $validated['subjects'],
            'onboarding_step' => 2, // Move to step 2 (subject dates)
        ]);

        return back()->with('success', 'Subjects saved successfully!');
    }

}
