<?php

namespace App\Http\Controllers;

use App\Services\StudyPlanService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Illuminate\Http\RedirectResponse;

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

        return Inertia::render('dashboard', [
            'plan' => $plan,
            'completedToday' => $completedSessions,
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
            return back()->with('error', 'We encountered an error while optimizing your plan: ' . $e->getMessage());
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
