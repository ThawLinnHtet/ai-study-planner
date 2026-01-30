<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class OnboardingController extends Controller
{
    private const TOTAL_STEPS = 6;

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
                'exam_dates' => $user->exam_dates ?? [],
                'daily_study_hours' => $user->daily_study_hours,
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
                'subjects' => ['required', 'array', 'min:1', 'max:30'],
                'subjects.*' => ['required', 'string', 'max:100'],
            ]);

            $subjects = collect($data['subjects'])
                ->map(fn (string $s) => trim($s))
                ->filter(fn (string $s) => $s !== '')
                ->unique()
                ->values()
                ->all();

            $user->forceFill([
                'subjects' => $subjects,
                'onboarding_step' => max((int) ($user->onboarding_step ?? 1), 3),
            ])->save();

            return redirect('/onboarding');
        }

        if ($step === 3) {
            $data = $request->validate([
                'exam_dates' => ['required', 'array'],
                'exam_dates.*' => ['nullable', 'date'],
            ]);

            $user->forceFill([
                'exam_dates' => $data['exam_dates'],
                'onboarding_step' => max((int) ($user->onboarding_step ?? 1), 4),
            ])->save();

            return redirect('/onboarding');
        }

        if ($step === 4) {
            $data = $request->validate([
                'daily_study_hours' => ['required', 'integer', 'min:1', 'max:24'],
            ]);

            $user->forceFill([
                'daily_study_hours' => $data['daily_study_hours'],
                'onboarding_step' => max((int) ($user->onboarding_step ?? 1), 5),
            ])->save();

            return redirect('/onboarding');
        }

        if ($step === 5) {
            $data = $request->validate([
                'learning_style' => ['required', 'string', 'max:50'],
                'study_goal' => ['required', 'string', 'max:255'],
                'timezone' => ['nullable', 'string', 'max:100'],
            ]);

            $user->forceFill([
                'learning_style' => $data['learning_style'],
                'study_goal' => $data['study_goal'],
                'timezone' => $data['timezone'] ?? null,
                'onboarding_step' => max((int) ($user->onboarding_step ?? 1), 6),
            ])->save();

            return redirect('/onboarding');
        }

        $request->validate([
            'confirm' => ['required', 'boolean', 'accepted'],
        ]);

        $user->forceFill([
            'onboarding_completed' => true,
            'onboarding_step' => self::TOTAL_STEPS,
        ])->save();

        return redirect()->route('dashboard');
    }
}
