<?php

namespace App\Http\Controllers;

use App\Models\StudyPlan;
use App\Models\User;
use App\Services\StudyPlanService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class StudyPlanController extends Controller
{
    protected StudyPlanService $studyPlanService;

    public function __construct(StudyPlanService $studyPlanService)
    {
        $this->studyPlanService = $studyPlanService;
    }

    /**
     * Display a high-level summary on the dashboard.
     */
    public function dashboard(Request $request): Response
    {
        $user = $request->user();
        $activePlan = $user->studyPlans()
            ->where('status', 'active')
            ->first();

        $completedSessions = $user->studySessions()
            ->where('started_at', '>=', now()->startOfDay())
            ->get();

        $plan = $activePlan !== null
            ? $this->studyPlanService->getPlanForCurrentWeek($activePlan)
            : null;

        // If no plan exists but user completed onboarding, create a fallback plan
        if (! $plan && $user->onboarding_completed) {
            try {
                // Try to create a fallback plan if none exists
                $this->createFallbackPlanIfNeeded($user);

                // Try to get the plan again
                $activePlan = $user->studyPlans()
                    ->where('status', 'active')
                    ->first();
                $plan = $activePlan !== null
                    ? $this->studyPlanService->getPlanForCurrentWeek($activePlan)
                    : null;
            } catch (\Exception $e) {
                logger()->error('Failed to create fallback plan for dashboard: '.$e->getMessage());
            }
        }

        return Inertia::render('dashboard', [
            'plan' => $plan,
            'completedToday' => $completedSessions,
            'onboardingCompleted' => $user->onboarding_completed,
        ]);
    }

    /**
     * Create a fallback plan if user has completed onboarding but no plan exists.
     */
    private function createFallbackPlanIfNeeded(User $user): void
    {
        // Check if user already has any plans
        $existingPlan = $user->studyPlans()->first();
        if ($existingPlan) {
            return; // User already has a plan (maybe archived)
        }

        $subjects = $user->subjects ?? [];
        // Ensure subjects is always an array
        if (is_string($subjects)) {
            $subjects = json_decode($subjects, true) ?? [];
        }
        $dailyHours = $user->daily_study_hours ?? 2;
        $peakTime = $user->productivity_peak ?? 'morning';

        if (empty($subjects) || ! is_array($subjects)) {
            return; // No subjects to create plan for
        }

        // Create a simple schedule
        $schedule = [];
        $days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

        foreach ($days as $day) {
            $daySessions = [];
            $subjectIndex = 0;
            $remainingMinutes = $dailyHours * 60;

            while ($remainingMinutes > 30 && $subjectIndex < count($subjects)) {
                $sessionMinutes = min(90, $remainingMinutes);
                $subject = $subjects[$subjectIndex];

                $daySessions[] = [
                    'subject' => $subject,
                    'topic' => 'Study Session',
                    'duration_minutes' => $sessionMinutes,
                    'focus_level' => $peakTime === 'morning' && $day === 'Monday' ? 'high' : 'medium',
                ];

                $remainingMinutes -= $sessionMinutes;
                $subjectIndex = ($subjectIndex + 1) % count($subjects);
            }

            $schedule[$day] = ['sessions' => $daySessions];
        }

        // Create the study plan
        StudyPlan::create([
            'user_id' => $user->id,
            'title' => 'Basic Study Plan',
            'goal' => $user->study_goal ?? 'General Study Improvement',
            'starts_on' => now()->startOfDay(),
            'ends_on' => now()->addDays(7),
            'target_hours_per_week' => $dailyHours * 7,
            'status' => 'active',
            'preferences' => [
                'productivity_peak' => $peakTime,
                'learning_style' => $user->learning_style ?? [],
            ],
            'generated_plan' => [
                'schedule' => $schedule,
                'strategy_summary' => 'Basic study plan created to help you get started. You can refine this with AI recommendations later.',
                'weeks' => [
                    [
                        'week_start' => now()->startOfDay()->toDateString(),
                        'schedule' => $schedule,
                    ],
                ],
            ],
        ]);
    }

    /**
     * Display the full weekly study planner.
     */
    public function index(Request $request): Response
    {
        $user = $request->user();
        $activePlan = $user->studyPlans()
            ->where('status', 'active')
            ->first();

        $recentSessions = $user->studySessions()
            ->where('started_at', '>=', now()->startOfWeek())
            ->get();

        $plan = $activePlan !== null
            ? $this->studyPlanService->getPlanForCurrentWeek($activePlan)
            : null;

        return Inertia::render('study-planner', [
            'plan' => $plan,
            'completedSessions' => $recentSessions,
        ]);
    }

    /**
     * Trigger a manual re-balance of the study plan based on recent performance.
     */
    public function rebalance(Request $request): RedirectResponse
    {
        try {
            $this->studyPlanService->rebalancePlan($request->user());

            return back()->with('success', 'Your study plan has been optimized based on your recent progress!');
        } catch (\Exception $e) {
            return back()->with('error', 'We encountered an error while optimizing your plan: '.$e->getMessage());
        }
    }

    public function toggleSession(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'subject' => ['required', 'string'],
            'topic' => ['required', 'string'],
            'duration_minutes' => ['required', 'integer'],
            'started_at' => ['required', 'date'],
            'status' => ['required', 'string', 'in:completed,pending'],
        ]);

        $user = $request->user();

        if ($validated['status'] === 'completed') {
            $user->studySessions()->create([
                'subject_id' => null, // We could look this up by name if needed
                'study_plan_id' => $user->studyPlans()->where('status', 'active')->value('id'),
                'started_at' => $validated['started_at'],
                'duration_minutes' => $validated['duration_minutes'],
                'type' => 'study',
                'status' => 'completed',
                'notes' => "Completed session: {$validated['topic']}",
                'meta' => ['subject_name' => $validated['subject'], 'topic_name' => $validated['topic']],
            ]);
        } else {
            // Un-toggle: find and delete the existing record for this day/subject/topic
            $user->studySessions()
                ->where('started_at', $validated['started_at'])
                ->whereJsonContains('meta->topic_name', $validated['topic'])
                ->delete();
        }

        return back();
    }
}
