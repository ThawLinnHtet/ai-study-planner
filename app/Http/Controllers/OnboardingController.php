<?php

namespace App\Http\Controllers;

use App\Services\StudyHoursValidator;
use App\Services\StudyPlanService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class OnboardingController extends Controller
{
    private const TOTAL_STEPS = 6;

    protected StudyPlanService $studyPlanService;

    public function __construct(StudyPlanService $studyPlanService)
    {
        $this->studyPlanService = $studyPlanService;
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
                'subjects' => json_decode($user->subjects ?? '[]', true) ?? [],
                'exam_dates' => $user->exam_dates ?? [],
                'subject_difficulties' => $user->subject_difficulties ?? [],
                'daily_study_hours' => $user->daily_study_hours,
                'productivity_peak' => $user->productivity_peak,
                'learning_style' => $user->learning_style,
                'study_goal' => $user->study_goal,
                'timezone' => $user->timezone,
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'step' => ['required', 'integer', 'min:1', 'max:'.self::TOTAL_STEPS],
        ]);

        $step = (int) $validated['step'];

        if ($step === 1) {
            $user->forceFill([
                'onboarding_step' => max((int) ($user->onboarding_step ?? 1), 2),
            ])->save();

            return redirect('/onboarding');
        }

        if ($step === 2) {
            $data = $request->validate([
                'subjects' => ['required', 'array', 'min:1', 'max:15'],
                'subjects.*' => ['required', 'string', 'min:2', 'max:100'],
            ], [
                'subjects.max' => 'You can select a maximum of 15 subjects.',
                'subjects.*.min' => 'Subject names must be at least 2 characters long.',
            ]);

            $subjects = collect($data['subjects'])
                ->map(fn (string $s) => trim($s))
                ->filter(fn (string $s) => $s !== '')
                // Filter out subjects that are only numbers or special characters
                ->filter(fn (string $s) => preg_match('/[a-zA-Z]/', $s))
                // Normalize to Title Case for Neuron AI
                ->map(fn (string $s) => mb_convert_case($s, MB_CASE_TITLE, "UTF-8"))
                // Remove duplicates (case-insensitive)
                ->unique(fn (string $s) => mb_strtolower($s, 'UTF-8'))
                ->values()
                ->all();

            if (empty($subjects)) {
                return back()->withErrors([
                    'subjects' => 'Please add at least one valid subject.',
                ]);
            }

            $user->forceFill([
                'subjects' => json_encode($subjects),
                'onboarding_step' => max((int) ($user->onboarding_step ?? 1), 3),
            ])->save();

            return redirect('/onboarding');
        }

        if ($step === 3) {
            // Normalize empty exam date strings to null so validation accepts them
            $examDatesInput = $request->input('exam_dates', []);
            if (is_array($examDatesInput)) {
                $request->merge([
                    'exam_dates' => collect($examDatesInput)->map(fn ($v) => $v === '' ? null : $v)->all(),
                ]);
            }

            $data = $request->validate([
                'subjects' => ['required', 'array', 'min:1', 'max:15'],
                'subjects.*' => ['required', 'string', 'min:2', 'max:100'],
                'exam_dates' => ['required', 'array'],
                'exam_dates.*' => [
                    'nullable',
                    'date',
                    'after_or_equal:today',
                    'before:' . now()->addYears(5)->format('Y-m-d'),
                ],
                'subject_difficulties' => ['nullable', 'array'],
                'subject_difficulties.*' => ['nullable', 'integer', 'min:1', 'max:3'],
            ], [
                'exam_dates.*.after_or_equal' => 'Exam dates must be in the future.',
                'exam_dates.*.before' => 'Exam dates must be within the next 5 years.',
            ]);

            // Process subjects from current form data (not database)
            $subjects = collect($data['subjects'])
                ->map(fn (string $s) => trim($s))
                ->filter(fn (string $s) => $s !== '')
                ->filter(fn (string $s) => preg_match('/[a-zA-Z]/', $s))
                ->map(fn (string $s) => mb_convert_case($s, MB_CASE_TITLE, "UTF-8"))
                ->unique(fn (string $s) => mb_strtolower($s, 'UTF-8'))
                ->values()
                ->all();

            // Keep only subjects that have a non-empty date set (do not store null in DB)
            $examDates = collect($data['exam_dates'] ?? [])
                ->filter(fn ($date, $subject) => in_array($subject, $subjects) && $date !== null && $date !== '')
                ->all();

            $difficulties = collect($data['subject_difficulties'] ?? [])
                ->filter(function ($diff, $subject) use ($subjects) {
                    // Case-insensitive comparison to handle "and" vs "And"
                    $normalizedSubject = strtolower($subject);
                    $normalizedSubjects = array_map('strtolower', $subjects);
                    $inSubjects = in_array($normalizedSubject, $normalizedSubjects);
                    return $inSubjects;
                })
                ->map(fn ($d) => is_numeric($d) ? (int) max(1, min(3, (int) $d)) : null)
                ->filter(fn ($d) => $d !== null)
                ->all();

            $user->forceFill([
                'subjects' => json_encode($subjects), // Save current subjects from form
                'exam_dates' => $examDates,
                'subject_difficulties' => $difficulties,
                'onboarding_step' => max((int) ($user->onboarding_step ?? 1), 4),
            ])->save();

            return redirect('/onboarding');
        }

        if ($step === 4) {
            $data = $request->validate([
                'daily_study_hours' => [
                    'nullable',
                    'integer',
                    'min:1',
                    'max:16',
                ],
                'productivity_peak' => [
                    'nullable',
                    'string',
                    'in:morning,afternoon,evening,night',
                ],
            ], [
                'daily_study_hours.max' => 'Please enter a realistic study time (maximum 16 hours per day).',
                'daily_study_hours.min' => 'Please enter at least 1 hour per day.',
            ]);

            $dailyHours = $data['daily_study_hours'] ?? 2;
            $peakTime = $data['productivity_peak'] ?? 'morning';

            // Validate study hours against focus capacity
            $validation = StudyHoursValidator::validateAndAdjust($dailyHours, $peakTime);
            
            // If the requested hours are unrealistic, block progression and show errors
            if (!$validation['is_realistic']) {
                return back()
                    ->withErrors([
                        'daily_study_hours' => 'Study time of ' . $dailyHours . ' hours exceeds recommended limits. For optimal learning, please choose 1-6 hours per day.'
                    ])
                    ->withInput()
                    ->with('study_hours_warnings', $validation['warnings'])
                    ->with('study_hours_recommendations', $validation['adjustments'])
                    ->with('validation_failed', true);
            }

            // Only save and proceed if hours are realistic
            $user->forceFill([
                'daily_study_hours' => $validation['recommended_hours'],
                'productivity_peak' => $peakTime,
                // Preserve existing subjects and difficulties
                'subjects' => $user->subjects,
                'subject_difficulties' => $user->subject_difficulties,
                'onboarding_step' => max((int) ($user->onboarding_step ?? 1), 5),
            ])->save();

            return redirect('/onboarding');
        }

        if ($step === 5) {
            $data = $request->validate([
                'learning_style' => ['required', 'array', 'min:1'],
                'learning_style.*' => ['string', 'in:visual,auditory,reading,kinesthetic'],
                'study_goal' => ['required', 'string', 'min:3', 'max:255'],
                'timezone' => ['nullable', 'string', 'timezone:all'],
            ]);

            $timezone = $data['timezone'] ?? null;
            if ($timezone === 'Asia/Rangoon') {
                $timezone = 'Asia/Yangon';
            }

            $user->forceFill([
                'learning_style' => $data['learning_style'],
                'study_goal' => $data['study_goal'],
                'timezone' => $timezone,
                // Preserve existing subjects and difficulties
                'subjects' => $user->subjects,
                'subject_difficulties' => $user->subject_difficulties,
                'onboarding_step' => max((int) ($user->onboarding_step ?? 1), 6),
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
        ])->save();

        // Generate initial study plan using the service
        try {
            $this->studyPlanService->generateInitialPlan($user);
        } catch (\Exception $e) {
            // Log or handle error - we don't want to break the onboarding completion
            // if AI fails, but user should be notified later or plan generated via queue.
            logger()->error('Failed to generate initial study plan: ' . $e->getMessage());
        }

        return redirect()->route('dashboard');
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
        'onboarding_step' => 2, // Move to step 2 (exam dates)
    ]);

    return back()->with('success', 'Subjects saved successfully!');
}
}
