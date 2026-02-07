<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Services\StudyHoursValidator;
use App\Services\StudyPlanService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class OnboardingSettingsController extends Controller
{
    protected StudyPlanService $studyPlanService;

    public function __construct(StudyPlanService $studyPlanService)
    {
        $this->studyPlanService = $studyPlanService;
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
                'exam_dates' => $user->exam_dates ?? [],
                'subject_difficulties' => $user->subject_difficulties ?? [],
                'daily_study_hours' => $user->daily_study_hours,
                'productivity_peak' => $user->productivity_peak,
                'learning_style' => $user->learning_style ?? [],
                'study_goal' => $user->study_goal,
                'timezone' => $user->timezone,
                'onboarding_completed' => $user->onboarding_completed,
                'onboarding_step' => $user->onboarding_step,
            ],
            'activePlan' => $user->studyPlans()
                ->where('status', 'active')
                ->first(),
        ]);
    }

    /**
     * Update the onboarding settings.
     */
    public function update(Request $request): RedirectResponse
    {
        $user = $request->user();

        // DEBUG: Log incoming request data
        \Log::info('=== SETTINGS UPDATE DEBUG ===');
        \Log::info('Request data', $request->all());
        \Log::info('Regenerate plan flag', ['regenerate_plan' => $request->input('regenerate_plan')]);

        $validated = $request->validate([
            'subjects' => ['required', 'array', 'min:1'],
            'subjects.*' => ['required', 'string', 'max:255'],
            'exam_dates' => ['nullable', 'array'],
            'exam_dates.*' => ['nullable', 'date'],
            'subject_difficulties' => ['nullable', 'array'],
            'subject_difficulties.*' => ['nullable', 'integer', 'min:1', 'max:3'],
            'daily_study_hours' => ['required', 'integer', 'min:1', 'max:6'],
            'productivity_peak' => ['required', 'string', 'in:morning,afternoon,evening,night'],
            'learning_style' => ['required', 'array', 'min:1'],
            'learning_style.*' => ['required', 'string', 'in:visual,auditory,reading,kinesthetic'],
            'study_goal' => ['required', 'string', 'min:3', 'max:255'],
            'timezone' => ['nullable', 'string', 'timezone:all'],
            'regenerate_plan' => ['nullable', 'boolean'],
        ], [
            'subjects.required' => 'Please select at least one subject.',
            'daily_study_hours.min' => 'Study time must be at least 1 hour per day.',
            'daily_study_hours.max' => 'Study time cannot exceed 6 hours per day for optimal learning.',
            'productivity_peak.required' => 'Please select your peak productivity time.',
            'learning_style.required' => 'Please select at least one learning style.',
        ]);

        // Validate study hours against focus capacity
        $validation = StudyHoursValidator::validateAndAdjust(
            $validated['daily_study_hours'],
            $validated['productivity_peak']
        );

        // If hours are unrealistic, show error but allow user to proceed (they're updating, not new onboarding)
        if (! $validation['is_realistic']) {
            // For settings, we'll allow the change but show strong warnings
            $warnings = $validation['warnings'];
            $validated['daily_study_hours'] = $validation['recommended_hours'];

            return back()
                ->with('study_hours_warnings', $warnings)
                ->with('study_hours_recommendations', $validation['adjustments'])
                ->with('original_hours', $validation['original_hours'])
                ->with('recommended_hours', $validation['recommended_hours'])
                ->with('hours_adjusted', true);
        }

        // Update user settings
        \Log::info('=== UPDATING USER SETTINGS ===');
        \Log::info('Validated data', $validated);

        $user->update([
            'subjects' => $validated['subjects'],
            'exam_dates' => $validated['exam_dates'] ?? [],
            'subject_difficulties' => $validated['subject_difficulties'] ?? [],
            'daily_study_hours' => $validated['daily_study_hours'],
            'productivity_peak' => $validated['productivity_peak'],
            'learning_style' => $validated['learning_style'],
            'study_goal' => $validated['study_goal'],
            'timezone' => $validated['timezone'],
        ]);

        \Log::info('✅ User settings updated successfully');

        // Verify the data was actually saved
        $user->refresh();

        // Regenerate study plan if requested
        if ($validated['regenerate_plan'] ?? false) {
            \Log::info('=== GENERATING NEW STUDY PLAN ===');

            try {
                // Refresh user to get the latest saved data
                $user->refresh();

                // Use the fresh data from database instead of request data
                $planData = [
                    'subjects' => $user->subjects,
                    'exam_dates' => $user->exam_dates ?? [],
                    'subject_difficulties' => $user->subject_difficulties ?? [],
                    'daily_study_hours' => $user->daily_study_hours,
                    'productivity_peak' => $user->productivity_peak,
                    'learning_style' => $user->learning_style,
                    'study_goal' => $user->study_goal,
                    'timezone' => $user->timezone,
                ];

                \Log::info('Plan data for AI (from fresh user data)', $planData);

                $this->studyPlanService->generatePlanWithData($user, $planData);

                \Log::info('✅ Study plan generated successfully');

                // Verify the study plan was actually created
                $newPlan = $user->studyPlans()->where('status', 'active')->first();
                \Log::info('=== VERIFYING NEW STUDY PLAN ===');
                \Log::info('New plan ID', ['plan_id' => $newPlan ? $newPlan->id : 'null']);
                \Log::info('New plan title', ['plan_title' => $newPlan ? $newPlan->title : 'null']);
                \Log::info('New plan status', ['plan_status' => $newPlan ? $newPlan->status : 'null']);
                \Log::info('New plan created at', ['created_at' => $newPlan ? $newPlan->created_at : 'null']);

                session()->flash('success', 'Your study preferences have been updated and a new study plan has been generated with your latest preferences!');

                return redirect()->route('study-planner');
            } catch (\Exception $e) {
                \Log::error('❌ Failed to generate study plan: '.$e->getMessage());
                session()->flash('success', 'Your study preferences have been updated! However, we encountered an error generating a new study plan: '.$e->getMessage());

                return redirect()->route('onboarding-settings.edit');
            }
        }

        // No regeneration requested - preferences saved without changes (silent)
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
            'exam_dates' => null,
            'subject_difficulties' => null,
            'daily_study_hours' => null,
            'productivity_peak' => null,
            'learning_style' => null,
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
