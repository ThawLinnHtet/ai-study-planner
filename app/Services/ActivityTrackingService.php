<?php

namespace App\Services;

use App\Models\User;
use App\Models\UserActivityLog;
use Carbon\Carbon;

class ActivityTrackingService
{
    public function log(User $user, string $eventType, array $payload = []): UserActivityLog
    {
        // Prevent infinite loop - don't update streak for streak-related events
        $shouldUpdateStreak = !in_array($eventType, [
            'streak_break',
            'streak_continued', 
            'streak_milestone',
            'grace_period_used'
        ]);

        $timezone = $user->timezone ?? config('app.timezone');
        $log = UserActivityLog::create([
            'user_id' => $user->id,
            'event_type' => $eventType,
            'payload' => $payload,
            'occurred_at' => now($timezone),
        ]);

        if ($shouldUpdateStreak) {
            $this->updateStreak($user);
        }

        return $log;
    }

    public function updateStreak(User $user): void
    {
        $timezone = $user->timezone ?? config('app.timezone');
        $today = Carbon::today($timezone);
        $lastStudyDate = $user->last_study_date ? Carbon::parse($user->last_study_date, $timezone)->startOfDay() : null;

        if (!$lastStudyDate || $lastStudyDate->lt($today)) {
            $daysSince = $lastStudyDate ? $lastStudyDate->diffInDays($today) : 999;
            $currentStreak = $user->study_streak ?? 0;
            
            // Grace period: 1 day for streaks > 7 days, 2 days for streaks > 30 days
            $gracePeriod = $this->getGracePeriod($currentStreak);
            
            if ($daysSince === 1) {
                // Studied yesterday - continue streak
                $user->study_streak = $currentStreak + 1;
                $this->logStreakContinued($user, $currentStreak + 1);
            } elseif ($daysSince <= (1 + $gracePeriod)) {
                // Within grace period - maintain streak
                $user->study_streak = $currentStreak + 1;
                $this->logGracePeriodUsed($user, $currentStreak, $daysSince);
            } else {
                // Break streak - start new one
                $this->handleStreakBreak($user, $currentStreak, $daysSince);
                $user->study_streak = 1;
            }
            
            $user->last_study_date = $today;
            $user->save();
        }
    }

    /**
     * Get grace period based on current streak length
     */
    private function getGracePeriod(int $streak): int
    {
        if ($streak >= 30) {
            return 2; // 2 days grace for 30+ day streaks
        } elseif ($streak >= 7) {
            return 1; // 1 day grace for 7+ day streaks
        }
        return 0; // No grace for new streaks
    }

    /**
     * Handle streak break with encouraging message
     */
    private function handleStreakBreak(User $user, int $previousStreak, int $daysSince): void
    {
        // Log streak break for analytics
        $timezone = $user->timezone ?? config('app.timezone');
        $this->log($user, 'streak_break', [
            'previous_streak' => $previousStreak,
            'days_since' => $daysSince,
            'break_date' => Carbon::today($timezone)->toDateString(),
        ]);

        // Create encouraging reminder about previous achievement
        if ($previousStreak >= 7) {
            $this->createStreakBreakReminder($user, $previousStreak);
        }

        // Log milestone achievements
        $this->checkStreakMilestones($user, $previousStreak);
    }

    /**
     * Log streak continuation
     */
    protected function logStreakContinued(User $user, int $newStreak): void
    {
        $timezone = $user->timezone ?? config('app.timezone');
        $this->log($user, 'streak_continued', [
            'new_streak' => $newStreak,
            'date' => Carbon::today($timezone)->toDateString(),
        ]);

        // Check for milestone achievements
        $this->checkStreakMilestones($user, $newStreak);
    }

    /**
     * Log grace period usage
     */
    protected function logGracePeriodUsed(User $user, int $streak, int $daysSince): void
    {
        $timezone = $user->timezone ?? config('app.timezone');
        $this->log($user, 'grace_period_used', [
            'streak' => $streak,
            'days_since' => $daysSince,
            'grace_period' => $this->getGracePeriod($streak),
            'date' => Carbon::today($timezone)->toDateString(),
        ]);
    }

    /**
     * Create encouraging reminder after streak break
     */
    private function createStreakBreakReminder(User $user, int $previousStreak): void
    {
        $message = $this->generateStreakBreakMessage($previousStreak);
        $timezone = $user->timezone ?? config('app.timezone');
        
        // Create a reminder about the previous achievement
        \App\Models\Reminder::create([
            'user_id' => $user->id,
            'type' => 'streak_break_encouragement',
            'channel' => 'in_app',
            'title' => "🔥 Previous Achievement!",
            'message' => $message,
            'payload' => [
                'previous_streak' => $previousStreak,
            ],
            'send_at' => Carbon::now($timezone)->addMinutes(30), // Send in 30 minutes
            'status' => 'pending',
        ]);
    }

    /**
     * Generate encouraging message for streak break
     */
    private function generateStreakBreakMessage(int $previousStreak): string
    {
        if ($previousStreak >= 100) {
            return "Amazing! You had a {$previousStreak}-day streak! That's incredible dedication. Time to start a new journey! 🚀";
        } elseif ($previousStreak >= 50) {
            return "Fantastic! You reached a {$previousStreak}-day streak! That's real commitment. Let's build another one! 💪";
        } elseif ($previousStreak >= 30) {
            return "Great job! You had a {$previousStreak}-day streak! That's a whole month of consistent learning. Ready for round two? 🎯";
        } elseif ($previousStreak >= 14) {
            return "Nice work! You had a {$previousStreak}-day streak! Two weeks of dedication is impressive. Let's do it again! 🌟";
        } elseif ($previousStreak >= 7) {
            return "Good effort! You had a {$previousStreak}-day streak! One week of consistent study is solid. Time to start fresh! 📚";
        } else {
            return "Every streak starts with day 1! You've got this! Let's build a new habit together! 🌱";
        }
    }

    /**
     * Check and log streak milestones
     */
    private function checkStreakMilestones(User $user, int $streak): void
    {
        $milestones = [7, 14, 30, 50, 100, 200, 365];
        
        if (in_array($streak, $milestones)) {
            $timezone = $user->timezone ?? config('app.timezone');
            $this->log($user, 'streak_milestone', [
                'milestone' => $streak,
                'date' => Carbon::today($timezone)->toDateString(),
            ]);

            // Create milestone celebration reminder
            \App\Models\Reminder::create([
                'user_id' => $user->id,
                'type' => 'streak_milestone',
                'channel' => 'in_app',
                'title' => "🎉 Streak Milestone!",
                'message' => "Congratulations on reaching {$streak} days! Keep up the amazing work! 🏆",
                'payload' => [
                    'milestone' => $streak,
                ],
                'send_at' => Carbon::now($timezone)->addMinutes(15),
                'status' => 'pending',
            ]);
        }
    }

    public function inferReminderWindow(User $user): ?string
    {
        $timezone = $user->timezone ?? config('app.timezone');
        $logs = UserActivityLog::where('user_id', $user->id)
            ->whereIn('event_type', [
                'study_session_started',
                'study_session_completed',
                'task_completed',
                'quiz_started',
                'quiz_completed',
            ])
            ->where('occurred_at', '>=', now($timezone)->subDays(7))
            ->get();

        if ($logs->count() < 3) {
            return null;
        }

        $hourBuckets = [];
        foreach ($logs as $log) {
            $hour = $log->occurred_at->hour;
            $window = $this->hourToWindow($hour);
            $hourBuckets[$window] = ($hourBuckets[$window] ?? 0) + 1;
        }

        arsort($hourBuckets);
        $topWindow = array_key_first($hourBuckets);

        $user->update([
            'reminder_window' => $topWindow,
            'reminder_window_inferred' => true,
        ]);

        return $topWindow;
    }

    public function hourToWindow(int $hour): string
    {
        if ($hour >= 6 && $hour < 12) return 'morning';
        if ($hour >= 12 && $hour < 17) return 'afternoon';
        if ($hour >= 17 && $hour < 21) return 'evening';
        return 'night';
    }

    public function getWindowHour(string $window): int
    {
        return match ($window) {
            'morning' => 9,
            'afternoon' => 14,
            'evening' => 19,
            'night' => 21,
            default => 19,
        };
    }

    public function hasStudiedToday(User $user): bool
    {
        $timezone = $user->timezone ?? config('app.timezone');
        return UserActivityLog::where('user_id', $user->id)
            ->whereIn('event_type', [
                'study_session_started',
                'study_session_completed',
                'task_completed',
                'quiz_completed',
            ])
            ->where('occurred_at', '>=', Carbon::today($timezone))
            ->exists();
    }
}
