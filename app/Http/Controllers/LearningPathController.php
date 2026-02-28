<?php

namespace App\Http\Controllers;

use App\Services\ActivityTrackingService;
use App\Services\LearningPathService;
use App\Services\StudyPlanService;
use App\Services\UserProgressService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;

class LearningPathController extends Controller
{
    protected LearningPathService $learningPathService;
    protected UserProgressService $progress;
    protected ActivityTrackingService $activityService;
    protected StudyPlanService $studyPlanService;

    public function __construct(
        LearningPathService $learningPathService,
        UserProgressService $progress,
        ActivityTrackingService $activityService,
        StudyPlanService $studyPlanService
    ) {
        $this->learningPathService = $learningPathService;
        $this->progress = $progress;
        $this->activityService = $activityService;
        $this->studyPlanService = $studyPlanService;
    }

    /**
     * Display the study planner with Learning Path day tracks.
     */
    public function index(Request $request): Response
    {
        $user = $request->user();

        $activePaths = $this->learningPathService->getActiveLearningPaths($user);
        $completedPaths = $this->learningPathService->getCompletedLearningPaths($user);

        // Get recent completed sessions for status tracking
        $recentSessions = $user->studySessions()
            ->where('status', 'completed')
            ->orderBy('started_at', 'desc')
            ->take(50)
            ->get();

        return Inertia::render('study-planner', [
            'learningPaths' => $activePaths,
            'completedPaths' => $completedPaths,
            'completedSessions' => $recentSessions,
            'progress' => $this->progress->getStats($user, 14),
            'subjectStartDates' => $user->subject_start_dates ?? [],
            'subjectEndDates' => $user->subject_end_dates ?? [],
            'userStreak' => $user->study_streak ?? 0,
        ]);
    }

    /**
     * Set up a new Learning Path for a subject.
     */
    public function enroll(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'subject_name' => ['required', 'string', 'max:255'],
            'start_date' => ['required', 'date', 'after_or_equal:today'],
            'end_date' => ['required', 'date', 'after:start_date'],
            'difficulty' => ['nullable', 'integer', 'min:1', 'max:3'],
        ], [
            'subject_name.required' => 'Please select a subject.',
            'start_date.after_or_equal' => 'Start date must be today or in the future.',
            'end_date.after' => 'End date must be after the start date.',
        ]);

        try {
            $learningPath = $this->learningPathService->enroll($request->user(), $validated);

            session()->flash('success', "🚀 Your Learning Path for {$validated['subject_name']} is ready! Your {$learningPath->total_days}-day journey begins on " . $learningPath->start_date->format('M d, Y') . ".");

            return redirect()->route('study-planner');
        } catch (\Exception $e) {
            Log::error('Learning Path creation failed: ' . $e->getMessage());
            return back()->withErrors(['subject_name' => $e->getMessage()]);
        }
    }

    /**
     * Check Learning Path progress before deletion.
     */
    public function checkDelete(Request $request, int $learningPathId): JsonResponse
    {
        try {
            $info = $this->learningPathService->checkBeforeDelete($request->user(), $learningPathId);
            return response()->json($info);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 404);
        }
    }

    /**
     * Delete a Learning Path.
     */
    public function destroy(Request $request, int $learningPathId): RedirectResponse
    {
        $user = $request->user();

        try {
            // First check if it exists or was already deleted
            $info = $this->learningPathService->checkBeforeDelete($user, $learningPathId);
            
            if (isset($info['already_deleted']) && $info['already_deleted']) {
                session()->flash('success', "The subject has already been removed.");
                return redirect()->route('study-planner');
            }

            // Check if user wants to purge history
            $purgeHistory = (bool) $request->input('purge_history', false);

            // Perform deep purging instead of just deleting model
            $this->studyPlanService->purgeSubject($user, $info['subject_name'], $purgeHistory);

            if ($purgeHistory) {
                session()->flash('success', "The {$info['subject_name']} Learning Path and all its historical progress have been removed. You're starting with a fresh slate! ✨");
            } elseif ($info['has_progress']) {
                session()->flash('success', "We've removed the {$info['subject_name']} Learning Path. Your {$info['completed_days']} days of hard work will always be remembered! 🌟");
            } else {
                session()->flash('success', "The {$info['subject_name']} Learning Path has been removed.");
            }

            // Clear cache to update stats bar
            $this->progress->clearUserCache($user);

            return redirect()->route('study-planner');
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            // If it's completely gone from DB, just treat it as success
            session()->flash('success', "The subject has been removed.");
            return redirect()->route('study-planner');
        } catch (\Exception $e) {
            Log::error('Delete Learning Path failed: ' . $e->getMessage());
            return back()->with('error', 'Failed to remove subject: ' . $e->getMessage());
        }
    }

    /**
     * Complete a day in the Learning Path.
     */
    public function completeDay(Request $request, int $learningPathId): RedirectResponse|JsonResponse
    {
        $validated = $request->validate([
            'day_number' => ['required', 'integer', 'min:1'],
            'quiz_result_id' => ['required', 'integer', 'exists:quiz_results,id'],
        ]);

        $user = $request->user();

        // Verify quiz result belongs to user and is passed
        $quizResult = $user->quizResults()
            ->where('id', $validated['quiz_result_id'])
            ->first();

        if (!$quizResult || $quizResult->percentage < 70) {
            if ($request->expectsJson()) {
                return response()->json(['error' => 'You need to pass the quiz (70%+) to complete this day.'], 422);
            }
            return back()->withErrors(['quiz' => 'You need to pass the quiz (70%+) to complete this day.']);
        }

        try {
            $learningPath = $user->learningPaths()->findOrFail($learningPathId);
            $dayNumber = $validated['day_number'];

            // Get day data for the session metadata
            $dayData = $learningPath->getDayData($dayNumber);

            // Use the planned duration for this day, defaulting to 60 if not found
            $durationMinutes = $dayData['duration_minutes'] ?? 60;

            // Create study session linked to Learning Path
            $session = $user->studySessions()->create([
                'study_plan_id' => null,
                'learning_path_id' => $learningPath->id,
                'day_number' => $dayNumber,
                'started_at' => $quizResult->taken_at ?? now(),
                'duration_minutes' => $durationMinutes,
                'type' => 'study',
                'status' => 'completed',
                'notes' => "Completed Day {$dayNumber}: " . ($dayData['topic'] ?? $learningPath->subject_name),
                'meta' => [
                    'subject_name' => $learningPath->subject_name,
                    'topic_name' => $dayData['topic'] ?? "Day {$dayNumber}",
                    'subject' => $learningPath->subject_name,
                    'topic' => $dayData['topic'] ?? "Day {$dayNumber}",
                    'day_number' => $dayNumber,
                    'learning_path_id' => $learningPath->id,
                    'quiz_result_id' => $quizResult->id,
                    'quiz_percentage' => $quizResult->percentage,
                    'level' => $dayData['level'] ?? 'beginner',
                ],
            ]);

            // Link quiz result to study session
            $quizResult->update(['study_session_id' => $session->id]);

            // Advance to next day
            $this->learningPathService->completeDay($user, $learningPathId, $dayNumber);

            // Track activity
            $this->activityService->log($user, 'study_session_completed', [
                'subject' => $learningPath->subject_name,
                'topic' => $dayData['topic'] ?? "Day {$dayNumber}",
                'day_number' => $dayNumber,
                'duration_minutes' => $durationMinutes,
                'quiz_result_id' => $quizResult->id,
                'quiz_percentage' => $quizResult->percentage,
            ]);

            // Clear cache
            $this->progress->clearUserCache($user);

            $learningPath->refresh();

            $isCompleted = $learningPath->status === 'completed';
            $nextDay = $learningPath->current_day;

            if ($request->expectsJson()) {
                return response()->json([
                    'success' => true,
                    'next_day' => $nextDay,
                    'is_completed' => $isCompleted,
                    'progress_percent' => $learningPath->getProgressPercent(),
                ]);
            }

            if ($isCompleted) {
                session()->flash('success', "🎉 Congratulations! You've completed your entire {$learningPath->subject_name} Learning Path! All {$learningPath->total_days} days done! 🏆");
            } else {
                session()->flash('success', "✅ Day {$dayNumber} completed! Day {$nextDay} is now unlocked. Keep going! 🔥");
            }

            return redirect()->route('study-planner');
        } catch (\Exception $e) {
            Log::error('Complete day failed: ' . $e->getMessage());
            if ($request->expectsJson()) {
                return response()->json(['error' => $e->getMessage()], 422);
            }
            return back()->with('error', 'Failed to complete day: ' . $e->getMessage());
        }
    }

    /**
     * Uncomplete a day session in the Learning Path.
     */
    public function uncompleteDay(Request $request, int $learningPathId): RedirectResponse
    {
        $validated = $request->validate([
            'day_number' => ['required', 'integer', 'min:1'],
        ]);

        $user = $request->user();

        try {
            $learningPath = $user->learningPaths()->findOrFail($learningPathId);

            // Only allow uncompleting the most recently completed day
            $dayNumber = $validated['day_number'];
            $expectedDay = $learningPath->current_day - 1;

            if ($learningPath->isCurrentDayComplete()) {
                $expectedDay = $learningPath->current_day;
            }

            if ($dayNumber !== $expectedDay && $dayNumber !== $learningPath->current_day) {
                return back()->with('error', 'You can only undo the most recently completed day.');
            }

            // Delete the session
            $user->studySessions()
                ->where('learning_path_id', $learningPath->id)
                ->where('day_number', $dayNumber)
                ->delete();

            // Move current_day back
            if ($dayNumber < $learningPath->current_day) {
                $learningPath->update(['current_day' => $dayNumber, 'status' => 'active']);
            }

            // Clear cache
            $this->progress->clearUserCache($user);

            session()->flash('success', "Day {$dayNumber} has been uncompleted.");

            return redirect()->route('study-planner');
        } catch (\Exception $e) {
            return back()->with('error', 'Failed to uncomplete day: ' . $e->getMessage());
        }
    }

    /**
     * Skip a day in the Learning Path.
     */
    public function skipDay(Request $request, int $learningPathId): RedirectResponse|JsonResponse
    {
        $user = $request->user();

        try {
            $learningPath = $this->learningPathService->skipDay($user, $learningPathId);
            $daySkipped = $learningPath->current_day - 1;

            if ($request->expectsJson()) {
                return response()->json([
                    'success' => true,
                    'current_day' => $learningPath->current_day,
                    'progress_percent' => $learningPath->getProgressPercent(),
                ]);
            }

            session()->flash('success', "Day {$daySkipped} skipped. You've moved to Day {$learningPath->current_day}.");
            return redirect()->route('study-planner');

        } catch (\Exception $e) {
            Log::error('Skip day failed: ' . $e->getMessage());
            if ($request->expectsJson()) {
                return response()->json(['error' => $e->getMessage()], 422);
            }
            return back()->with('error', 'Failed to skip day: ' . $e->getMessage());
        }
    }
}
