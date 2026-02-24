<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\StudyPlan;
use App\Models\User;
use App\Services\ActivityTrackingService;
use App\Services\ProgressService;
use App\Services\StudyPlanService;
use App\Services\UserProgressService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Carbon\Carbon;
use Inertia\Inertia;
use Inertia\Response;
use Illuminate\Http\RedirectResponse;

class StudyPlanController extends Controller
{
    protected StudyPlanService $studyPlanService;
    protected UserProgressService $progress;
    protected ActivityTrackingService $activityService;

    public function __construct(StudyPlanService $studyPlanService, UserProgressService $progress, ActivityTrackingService $activityService)
    {
        $this->studyPlanService = $studyPlanService;
        $this->progress = $progress;
        $this->activityService = $activityService;
    }

    /**
     * Display a high-level summary on the dashboard.
     */
    public function dashboard(Request $request): Response
    {
        $user = $request->user();
        
        // Automatically fix any orphaned sessions
        $this->fixOrphanedSessions($user);
        
        $activePlan = $user->studyPlans()
            ->where('status', 'active')
            ->first();

        $timezone = $user->timezone ?? config('app.timezone');
        $completedSessions = $user->studySessions()
            ->where('started_at', '>=', Carbon::now($timezone)->startOfDay())
            ->get();

        if ($activePlan !== null) {
            $plan = $this->studyPlanService->getPlanForCurrentWeek($activePlan);
            
            // AUTOMATION: If the cycle is complete, renew immediately
            if (isset($plan['generated_plan']['is_cycle_complete']) && $plan['generated_plan']['is_cycle_complete']) {
                $renewedPlan = $this->autoRenewPlan($user, $activePlan);
                if ($renewedPlan) {
                    $plan = $this->studyPlanService->getPlanForCurrentWeek($renewedPlan);
                }
            }
        } else {
            $plan = null;
        }

        // If no plan exists but user completed onboarding, create a fallback plan
        if (!$plan && $user->onboarding_completed) {
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
                logger()->error('Failed to create fallback plan for dashboard: ' . $e->getMessage());
            }
        }

        $activeLearningPaths = $user->learningPaths()
            ->where('status', 'active')
            ->where('start_date', '<=', Carbon::now($timezone)->toDateString())
            ->get()
            ->map(function($path) {
                $dayData = $path->getDayData($path->current_day);
                return [
                    'id' => $path->id,
                    'subject' => $path->subject_name,
                    'topic' => $dayData['topic'] ?? 'Study Session',
                    'duration_minutes' => $dayData['duration_minutes'] ?? 60,
                    'is_learning_path' => true
                ];
            });

        $futureLearningPaths = $user->learningPaths()
            ->where('status', 'active')
            ->where('start_date', '>', Carbon::now($timezone)->toDateString())
            ->orderBy('start_date', 'asc')
            ->get();

        return Inertia::render('dashboard', [
            'plan' => $plan,
            'activeLearningPaths' => $activeLearningPaths,
            'futureLearningPaths' => $futureLearningPaths,
            'completedToday' => $completedSessions->map(function($s) {
                return [
                    'id' => $s->id,
                    'learning_path_id' => $s->learning_path_id,
                    'subject' => $s->meta['subject'] ?? ($s->learningPath ? $s->learningPath->subject_name : 'Study Session'),
                    'topic' => $s->meta['topic'] ?? 'Study Session',
                ];
            }),
            'onboardingCompleted' => $user->onboarding_completed,
            'isGeneratingPlan' => $user->is_generating_plan,
            'generatingStatus' => $user->generating_status,            'isBehindSchedule' => $user->learningPaths()->where('status', 'active')->get()->contains(fn($path) => $path->isBehindSchedule()),
            'progress' => $this->progress->getStats($user, 14),
        ]);
    }

    /**
     * Create a fallback plan if user has completed onboarding but no plan exists.
     */
    private function createFallbackPlanIfNeeded(User $user): void
    {
        // Only check active plans — archived plans should not block new plan creation
        $existingActivePlan = $user->studyPlans()->where('status', 'active')->first();
        if ($existingActivePlan || $user->is_generating_plan) {
            return;
        }

        $subjects = $user->subjects ?? [];
        // Ensure subjects is always an array
        if (is_string($subjects)) {
            $subjects = json_decode($subjects, true) ?? [];
        }
        $dailyHours = $user->daily_study_hours ?? 2;
        
        if (empty($subjects) || !is_array($subjects)) {
            return; // No subjects to create plan for
        }

        // Create a schedule with subject-specific topics from curriculum templates
        $timezone = $user->timezone ?? config('app.timezone');
        $startDates = $user->subject_start_dates ?? [];
        $endDates = $user->subject_end_dates ?? [];
        $sessionDurations = $user->subject_session_durations ?? [];
        $today = Carbon::now($timezone)->startOfDay();

        $topicCounters = []; // Track topic index per subject per tier to avoid repeats
        $getTopicLabel = function (string $subject, int $dayOffset) use ($startDates, $endDates, $today, $timezone, &$topicCounters) {
            $start = isset($startDates[$subject]) ? \Carbon\Carbon::parse($startDates[$subject], $timezone) : $today;
            $end = isset($endDates[$subject]) ? \Carbon\Carbon::parse($endDates[$subject], $timezone) : $today->copy()->addDays(30);
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
            $defaultSessionMin = max(15, min(90, (int) floor(($dailyHours * 60) / max(1, count($subjects)))));
            
            while ($remainingMinutes >= 15 && $subjectIndex < count($subjects)) {
                $subject = $subjects[$subjectIndex];
                $sessionMinutes = min($remainingMinutes, $defaultSessionMin);

                // Respect custom session durations if set
                if (isset($sessionDurations[$subject])) {
                    $min = max(15, min(120, (int) ($sessionDurations[$subject]['min'] ?? $defaultSessionMin)));
                    $max = max($min, min(120, (int) ($sessionDurations[$subject]['max'] ?? ($min + 15))));

                    // Never exceed remaining budget while still honoring user's preferred range.
                    $minWithinRemaining = min($min, $remainingMinutes);
                    $sessionMinutes = min($remainingMinutes, max($minWithinRemaining, min($max, $sessionMinutes)));
                }

                if ($sessionMinutes < 15) {
                    break;
                }
                
                $daySessions[] = [
                    'subject' => $subject,
                    'topic' => $getTopicLabel($subject, $dayIndex),
                    'duration_minutes' => $sessionMinutes,
                    'focus_level' => 'medium',
                ];
                
                $remainingMinutes -= $sessionMinutes;
                $subjectIndex = ($subjectIndex + 1) % count($subjects);
            }
            
            $schedule[$day] = ['sessions' => $daySessions];
        }

        // Resolve plan end date from subject end dates
        $endsOn = $today->copy()->addDays(29);
        if (!empty($endDates)) {
            $farthest = collect($endDates)->filter()->map(fn ($d) => \Carbon\Carbon::parse($d, $timezone))->max();
            if ($farthest && $farthest->gt($today)) {
                $endsOn = $farthest;
            }
        }

        StudyPlan::create([
            'user_id' => $user->id,
            'title' => "Monthly Study Plan",
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
                    ]
                ]
            ]
        ]);
    }

    /**
     * Display the full weekly study planner.
     */
    public function index(Request $request): Response
    {
        $user = $request->user();
        
        // Automatically fix any orphaned sessions
        $this->fixOrphanedSessions($user);
        
        $activePlan = $user->studyPlans()
            ->where('status', 'active')
            ->first();

        // Auto-renew expired plans
        $timezone = $user->timezone ?? config('app.timezone');
        if ($activePlan && $activePlan->ends_on && Carbon::parse($activePlan->ends_on, $timezone)->endOfDay()->isPast()) {
            $activePlan = $this->autoRenewPlan($user, $activePlan);
        }

        $recentSessions = $user->studySessions()
            ->where('status', 'completed')
            ->orderBy('started_at', 'desc')
            ->take(15) // Show last 15 completed sessions for better history
            ->get();

        // Get target date from query parameter, default to today
        $targetDate = $request->query('date');
        
        if ($activePlan !== null) {
            $plan = $this->studyPlanService->getPlanForCurrentWeek($activePlan, $targetDate);
            
            // AUTOMATION: If the cycle is complete, renew immediately
            // Only auto-renew if we are looking at the current date or later
            if (!$targetDate || Carbon::parse($targetDate)->isToday() || Carbon::parse($targetDate)->isFuture()) {
                if (isset($plan['generated_plan']['is_cycle_complete']) && $plan['generated_plan']['is_cycle_complete']) {
                    $renewedPlan = $this->autoRenewPlan($user, $activePlan);
                    if ($renewedPlan) {
                        $plan = $this->studyPlanService->getPlanForCurrentWeek($renewedPlan, $targetDate);
                    }
                }
            }
        } else {
            $plan = null;
        }

        return Inertia::render('study-planner', [
            'plan' => $plan,
            'completedSessions' => $recentSessions,
            'progress' => $this->progress->getStats($user, 14),
            'subjectStartDates' => $user->subject_start_dates ?? [],
            'subjectEndDates' => $user->subject_end_dates ?? [],
            'userStreak' => $user->study_streak ?? 0,
            'planExpired' => false,
            'isGeneratingPlan' => $user->is_generating_plan,
            'generatingStatus' => $user->generating_status,
        ]);
    }

    /**
     * Auto-renew an expired plan by generating a new one.
     */
    private function autoRenewPlan($user, $expiredPlan): ?\App\Models\StudyPlan
    {
        try {
            // Mark old plan as completed
            $expiredPlan->update(['status' => 'completed']);

            // Try AI-generated plan first
            $newPlan = $this->studyPlanService->generateInitialPlan($user);

            logger()->info('Auto-renewed study plan', [
                'user_id' => $user->id,
                'old_plan_id' => $expiredPlan->id,
                'new_plan_id' => $newPlan->id,
            ]);

            return $newPlan;
        } catch (\Exception $e) {
            logger()->error('Failed to auto-renew plan: ' . $e->getMessage());

            // Fallback: create a basic plan
            try {
                $this->createFallbackPlanIfNeeded($user);
                return $user->studyPlans()
                    ->where('status', 'active')
                    ->limit(1)
                    ->first();
            } catch (\Exception $fallbackError) {
                logger()->error('Fallback plan also failed: ' . $fallbackError->getMessage());
                return null;
            }
        }
    }

    /**
     * Automatically fix sessions that are linked to archived plans
     * This ensures all completed sessions are always visible
     */
    private function fixOrphanedSessions(User $user): void
    {
        // Get current active plan
        $activePlan = $this->getActivePlan($user);
        
        if (!$activePlan) {
            return;
        }
        
        // Find sessions linked to archived plans and move them to current active plan
        $orphanedSessions = $user->studySessions()
            ->whereHas('studyPlan', function($query) {
                $query->where('status', 'archived');
            })
            ->get();
            
        foreach($orphanedSessions as $session) {
            $session->update(['study_plan_id' => $activePlan->id]);
        }
        
        // Also fix sessions with null plan_id
        $nullPlanSessions = $user->studySessions()
            ->whereNull('study_plan_id')
            ->get();
            
        foreach($nullPlanSessions as $session) {
            $session->update(['study_plan_id' => $activePlan->id]);
        }
    }

    /**
     * Get the current active plan for the user, creating one if needed
     */
    private function getActivePlan(User $user): ?\App\Models\StudyPlan
    {
        // Always get the most recent active plan
        $activePlan = $user->studyPlans()
            ->where('status', 'active')
            ->orderBy('created_at', 'desc') // Get the newest active plan
            ->first();

        // If no active plan, create one
        if (!$activePlan) {
            $this->createFallbackPlanIfNeeded($user);
            $activePlan = $user->studyPlans()
                ->where('status', 'active')
                ->orderBy('created_at', 'desc')
                ->first();
        }

        return $activePlan;
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
            'quiz_result_id' => ['nullable', 'integer', 'exists:quiz_results,id'],
        ]);

        $user = $request->user();

        if ($validated['status'] === 'completed') {
            // Require quiz result to mark as completed
            if (empty($validated['quiz_result_id'])) {
                return back()->withErrors(['quiz' => 'Please complete the quiz first.']);
            }

            // Verify quiz result belongs to user and is passed
            $quizResult = $user->quizResults()
                ->where('id', $validated['quiz_result_id'])
                ->first();

            if (!$quizResult || $quizResult->percentage < 70) {
                return back()->withErrors(['quiz' => 'You need to pass the quiz (70%+) to complete this session.']);
            }

            // Get active study plan ID more efficiently with fallback
            $activePlanId = $user->studyPlans()
                ->where('status', 'active')
                ->limit(1)
                ->value('id');

            // If no active plan, try to get or create one
            if (!$activePlanId) {
                $activePlan = $this->getActivePlan($user);
                $activePlanId = $activePlan ? $activePlan->id : null;
            }

            $session = $user->studySessions()->create([
                'study_plan_id' => $activePlanId,
                'started_at' => $validated['started_at'],
                'duration_minutes' => $validated['duration_minutes'],
                'type' => 'study',
                'status' => 'completed',
                'notes' => "Completed session: {$validated['topic']}",
                'meta' => [
                    'subject_name' => $validated['subject'],
                    'topic_name' => $validated['topic'],
                    'quiz_result_id' => $quizResult->id,
                    'quiz_percentage' => $quizResult->percentage,
                    'fallback_plan' => !$activePlanId,
                ],
            ]);

            // Link quiz result to study session
            $quizResult->update(['study_session_id' => $session->id]);

            // Track session completion for streak
            $this->activityService->log($user, 'study_session_completed', [
                'subject' => $validated['subject'],
                'topic' => $validated['topic'],
                'duration_minutes' => $validated['duration_minutes'],
                'quiz_result_id' => $quizResult->id,
                'quiz_percentage' => $quizResult->percentage,
            ]);

            // Clear user progress cache to reflect new XP/level
            $this->progress->clearUserCache($user);
        } else {
            // Un-toggle: delete the completed session for this exact day/subject/topic.
            // Use strict AND matching to avoid accidentally deleting the wrong session.
            $user->studySessions()
                ->where('started_at', $validated['started_at'])
                ->whereRaw('LOWER(JSON_UNQUOTE(JSON_EXTRACT(meta, "$.subject_name"))) = ?', [strtolower(trim($validated['subject']))])
                ->whereRaw('LOWER(JSON_UNQUOTE(JSON_EXTRACT(meta, "$.topic_name"))) = ?', [strtolower(trim($validated['topic']))])
                ->delete();
        }

        return back();
    }

    /**
     * Complete a study session after passing a quiz
     */
    public function completeQuiz(Request $request, int $resultId)
    {
        $user = $request->user();

        // Verify quiz result belongs to user and is passed
        $quizResult = $user->quizResults()
            ->where('id', $resultId)
            ->first();

        if (!$quizResult || $quizResult->percentage < 70) {
            if ($request->expectsJson()) {
                return response()->json(['error' => 'Invalid or failed quiz result.'], 422);
            }
            return back()->withErrors(['quiz' => 'Invalid or failed quiz result.']);
        }

        // Idempotency: if already linked to a session, don't create a duplicate
        if ($quizResult->study_session_id) {
            if ($request->expectsJson()) {
                return response()->json(['success' => true, 'already_saved' => true]);
            }
            return redirect()->route('study-planner')->with('success', 'Study session already completed!');
        }

        // Get active study plan ID more efficiently with fallback
        $activePlanId = $user->studyPlans()
            ->where('status', 'active')
            ->limit(1)
            ->value('id');

        // If no active plan, try to get or create one
        if (!$activePlanId) {
            $activePlan = $this->getActivePlan($user);
            $activePlanId = $activePlan ? $activePlan->id : null;
        }

        // Extract subject, topic and duration from quiz settings if available
        $subject = $quizResult->quiz->title ?? 'Unknown Subject';
        $topic = 'Quiz Completion';
        $durationMinutes = 60; // fallback

        if ($quizResult->quiz->settings) {
            $settings = $quizResult->quiz->settings;
            $subject = $settings['subject'] ?? $subject;
            $topic = $settings['topic'] ?? $topic;
        }

        // Use the actual quiz duration if captured, otherwise fall back to 60 min
        if ($quizResult->duration_seconds && $quizResult->duration_seconds > 0) {
            $durationMinutes = (int) ceil($quizResult->duration_seconds / 60);
            // Clamp to realistic session bounds (5 min – 90 min)
            $durationMinutes = max(5, min(90, $durationMinutes));
        }

        $timezone = $user->timezone ?? config('app.timezone');
        $session = $user->studySessions()->create([
            'study_plan_id' => $activePlanId,
            'started_at' => $quizResult->taken_at ?? now($timezone),
            'duration_minutes' => $durationMinutes,
            'type' => 'study',
            'status' => 'completed',
            'notes' => "Completed session: {$topic}",
            'meta' => [
                'subject_name' => $subject,
                'topic_name' => $topic,
                'quiz_result_id' => $quizResult->id,
                'quiz_percentage' => $quizResult->percentage,
                'fallback_plan' => !$activePlanId,
            ],
        ]);

        // Link quiz result to study session
        $quizResult->update(['study_session_id' => $session->id]);

        // Track session completion for streak
        $this->activityService->log($user, 'study_session_completed', [
            'subject' => $subject,
            'topic' => $topic,
            'duration_minutes' => $durationMinutes,
            'quiz_result_id' => $quizResult->id,
            'quiz_percentage' => $quizResult->percentage,
        ]);

        // Clear user progress cache to reflect new XP/level
        $this->progress->clearUserCache($user);

        if ($request->expectsJson()) {
            return response()->json(['success' => true]);
        }

        return redirect()->route('study-planner')->with('success', 'Study session completed successfully!');
    }


    /**
     * Renew the study plan cycle.
     * Archives the expired plan and generates a fresh cycle from today.
     * A 1-hour cooldown is enforced using prevent_rebalance_until.
     */
    public function renewCycle(Request $request): RedirectResponse
    {
        $user = $request->user();

        // Enforce cooldown to prevent rapid back-to-back AI plan generation
        $timezone = $user->timezone ?? config('app.timezone');
        $activePlan = $user->studyPlans()->where('status', 'active')->first();
        if ($activePlan && $activePlan->prevent_rebalance_until && \Carbon\Carbon::now($timezone)->lt(Carbon::parse($activePlan->prevent_rebalance_until, $timezone))) {
            $waitMinutes = (int) \Carbon\Carbon::now($timezone)->diffInMinutes(Carbon::parse($activePlan->prevent_rebalance_until, $timezone));
            session()->flash('error', "Please wait {$waitMinutes} more minute(s) before renewing your plan.");
            return redirect()->route('study-planner');
        }

        // Archive any currently active plan
        if ($activePlan) {
            $activePlan->update(['status' => 'archived']);

            logger()->info('Archived expired plan for cycle renewal', [
                'user_id' => $user->id,
                'plan_id' => $activePlan->id,
                'ended_on' => $activePlan->ends_on,
            ]);
        }

        // Generate a fresh cycle plan from today
        try {
            $newPlan = $this->studyPlanService->generatePlanWithData($user, [
                'subjects' => $user->subjects,
                'subject_difficulties' => $user->subject_difficulties,
                'subject_start_dates' => $user->subject_start_dates ?? [],
                'subject_end_dates' => $user->subject_end_dates ?? [],
                'daily_study_hours' => $user->daily_study_hours,
                'study_goal' => $user->study_goal,
                'subject_session_durations' => $user->subject_session_durations ?? [],
            ]);

            $durationLabel = 'Monthly';

            session()->flash('success', "🚀 New {$durationLabel} study cycle started! Your AI-optimized schedule is ready.");

            return redirect()->route('study-planner');
        } catch (\Exception $e) {
            logger()->error('Failed to renew cycle: ' . $e->getMessage());
            session()->flash('error', 'Failed to generate new plan. Please try again.');
            return redirect()->route('dashboard');
        }
    }
}
