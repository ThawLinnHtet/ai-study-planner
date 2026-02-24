<?php

namespace App\Services;

use App\Models\User;
use Carbon\Carbon;

class BehavioralNotificationService
{
    public function __construct(
        protected ReminderService $reminderService,
        protected UserProgressService $progressService
    ) {}

    public function processAllUsers(): int
    {
        $users = User::where('reminders_enabled', true)
            ->where('onboarding_completed', true)
            ->get();

        $notificationsSent = 0;

        foreach ($users as $user) {
            $notificationsSent += $this->processUserBehavior($user);
        }

        return $notificationsSent;
    }

    public function processUserBehavior(User $user): int
    {
        $sentCount = 0;

        if ($this->checkInactivity($user)) {
            $sentCount++;
        }

        if ($this->checkStreakMilestone($user)) {
            $sentCount++;
        }

        if ($this->checkGoalProgress($user)) {
            $sentCount++;
        }

        return $sentCount;
    }

    protected function checkInactivity(User $user): bool
    {
        $lastStudyDate = $user->last_study_date;
        if (!$lastStudyDate) {
            return false;
        }

        $userTimezone = $user->timezone ?? config('app.timezone');
        $daysInactive = $lastStudyDate->copy()->tz($userTimezone)->startOfDay()->diffInDays(now($userTimezone)->startOfDay());

        if ($daysInactive === 3) {
            return $this->reminderService->notifyBehavioral(
                $user,
                'inactivity',
                "We miss you, {$user->name}!",
                "It's been 3 days since your last study session. A quick 15-minute review can get you back on track."
            );
        }

        return false;
    }

    protected function checkStreakMilestone(User $user): bool
    {
        $streak = $user->study_streak ?? 0;
        $milestones = [3, 7, 14, 30, 50, 100];

        if (in_array($streak, $milestones)) {
            return $this->reminderService->notifyBehavioral(
                $user,
                'streak_milestone',
                "🎉 You hit a {$streak}-day streak!",
                "Incredible consistency! You've studied for {$streak} days in a row. Keep up the great work!",
                ['streak' => $streak]
            );
        }

        return false;
    }

    protected function checkGoalProgress(User $user): bool
    {
        $stats = $this->progressService->getStats($user);
        $weeklyGoal = $stats['sessions']['week']['target_minutes'] ?? 0;
        $weeklyProgress = $stats['sessions']['week']['minutes'] ?? 0;

        if ($weeklyGoal <= 0) {
            return false;
        }

        $percent = ($weeklyProgress / $weeklyGoal) * 100;

        // Check if recently hit 50%
        if ($percent >= 50 && $percent < 60) {
            return $this->reminderService->notifyBehavioral(
                $user,
                'goal_halfway',
                "Halfway there! 🚀",
                "You've reached 50% of your weekly study goal. You're doing great, keep going!"
            );
        }

        // Check if recently hit 100%
        if ($percent >= 100 && $percent < 110) {
            return $this->reminderService->notifyBehavioral(
                $user,
                'goal_met',
                "🏆 Weekly Goal Crushed!",
                "Amazing job! You've completed 100% of your weekly study goal. Take a well-deserved break or keep the momentum going!"
            );
        }

        return false;
    }
}
