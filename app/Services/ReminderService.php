<?php

namespace App\Services;

use App\Models\Reminder;
use App\Models\User;
use Carbon\Carbon;

class ReminderService
{
    public const LIFE_REFILL_MINUTES = 30;
    protected ActivityTrackingService $activityService;

    public function __construct(ActivityTrackingService $activityService)
    {
        $this->activityService = $activityService;
    }

    public function scheduleRemindersForUser(User $user): void
    {
        if (!$user->reminders_enabled) {
            return;
        }

        $window = $user->reminder_window;
        if (!$window) {
            return;
        }

        // Use user's timezone for proper local time scheduling
        $userTimezone = $user->timezone ?? config('app.timezone');
        $today = Carbon::today($userTimezone);
        $windowHour = $this->activityService->getWindowHour($window);
        $sendAt = $today->copy()->setHour($windowHour)->setMinute(0)->setSecond(0);

        // Don't schedule if the window has already passed
        if ($sendAt->lt(now($userTimezone))) {
            return;
        }

        // Don't duplicate: check if a reminder already exists for today
        $existsToday = Reminder::where('user_id', $user->id)
            ->where('type', 'daily_nudge')
            ->whereDate('send_at', $today)
            ->exists();

        if ($existsToday) {
            return;
        }

        $hasStudied = $this->activityService->hasStudiedToday($user);
        if ($hasStudied) {
            return;
        }

        $streak = $user->study_streak ?? 0;
        $title = $this->getNudgeTitle($streak);
        $message = $this->getNudgeMessage($streak, $user);

        Reminder::create([
            'user_id' => $user->id,
            'type' => 'daily_nudge',
            'channel' => $user->email_notifications_enabled ? 'both' : 'in_app',
            'title' => $title,
            'message' => $message,
            'payload' => [
                'streak' => $streak,
                'window' => $window,
            ],
            'send_at' => $sendAt,
            'status' => 'pending',
        ]);
    }

    public function seedDemoReminders(User $user): void
    {
        $user->forceFill([
            'reminders_enabled' => true,
            'onboarding_completed' => true,
            'reminder_window' => $user->reminder_window ?? 'evening',
        ])->save();

        $timezone = $user->timezone ?? config('app.timezone');
        $now = Carbon::now($timezone);

        Reminder::where('user_id', $user->id)
            ->whereIn('status', ['pending', 'sent'])
            ->delete();

        $streak = max(1, $user->study_streak ?? 1);

        $sampleReminders = [
            [
                'type' => 'daily_nudge',
                'title' => '📘 15-minute review time',
                'message' => 'Stay on your streak—finish one quick session today.',
            ],
            [
                'type' => 'streak_risk',
                'title' => "🔥 Don't lose your {$streak}-day streak",
                'message' => 'One more study session keeps the progress!',
            ],
            [
                'type' => 'tasks_pending',
                'title' => '🔔 Tasks waiting',
                'message' => 'You still have 2 study tasks open for today.',
            ],
            [
                'type' => 'life_refill',
                'title' => '💖 Quiz life refilled',
                'message' => 'New attempts are ready—jump back into practice!',
            ],
        ];

        foreach ($sampleReminders as $data) {
            Reminder::create([
                'user_id' => $user->id,
                'type' => $data['type'],
                'channel' => 'in_app',
                'title' => $data['title'],
                'message' => $data['message'],
                'payload' => [],
                'send_at' => $now,
                'status' => 'sent',
                'sent_at' => $now,
            ]);
        }
    }

    public function scheduleLifeRefillReminder(User $user, Carbon $refillAt): void
    {
        if (!$user->reminders_enabled) {
            return;
        }

        // Remove outdated pending life reminders
        Reminder::where('user_id', $user->id)
            ->where('type', 'life_refill')
            ->where('status', 'pending')
            ->delete();

        Reminder::create([
            'user_id' => $user->id,
            'type' => 'life_refill',
            'channel' => $user->email_notifications_enabled ? 'both' : 'in_app',
            'title' => '💖 Quiz life refilled soon',
            'message' => 'We will ping you when another quiz attempt is ready.',
            'payload' => [
                'refill_minutes' => self::LIFE_REFILL_MINUTES,
            ],
            'send_at' => $refillAt,
            'status' => 'pending',
        ]);
    }

    public function scheduleStreakRiskReminder(User $user): void
    {
        if (!$user->reminders_enabled) {
            return;
        }

        $streak = $user->study_streak ?? 0;
        if ($streak < 2) {
            return;
        }

        $hasStudied = $this->activityService->hasStudiedToday($user);
        if ($hasStudied) {
            return;
        }

        // Check if streak risk reminder already sent today
        $userTimezone = $user->timezone ?? config('app.timezone');
        $existsToday = Reminder::where('user_id', $user->id)
            ->where('type', 'streak_risk')
            ->whereDate('send_at', Carbon::today($userTimezone))
            ->exists();

        if ($existsToday) {
            return;
        }

        $window = $user->reminder_window ?? 'evening';
        $windowHour = $this->activityService->getWindowHour($window);
        // Send streak risk 2 hours after their usual window
        $sendAt = Carbon::today($userTimezone)->setHour(min($windowHour + 2, 23))->setMinute(0);

        if ($sendAt->lt(now($userTimezone))) {
            return;
        }

        Reminder::create([
            'user_id' => $user->id,
            'type' => 'streak_risk',
            'channel' => $user->email_notifications_enabled ? 'both' : 'in_app',
            'title' => "🔥 Don't break your {$streak}-day streak!",
            'message' => "You haven't studied today yet. Just one quick session keeps your streak alive!",
            'payload' => [
                'streak' => $streak,
            ],
            'send_at' => $sendAt,
            'status' => 'pending',
        ]);
    }

    public function scheduleTasksPendingReminder(User $user, int $pendingCount): void
    {
        if (!$user->reminders_enabled || $pendingCount === 0) {
            return;
        }

        // Check if tasks pending reminder already sent today
        $userTimezone = $user->timezone ?? config('app.timezone');
        $existsToday = Reminder::where('user_id', $user->id)
            ->where('type', 'tasks_pending')
            ->whereDate('send_at', Carbon::today($userTimezone))
            ->exists();

        if ($existsToday) {
            return;
        }

        // Send in the evening if tasks are still pending
        $sendAt = Carbon::today($userTimezone)->setHour(20)->setMinute(0);
        if ($sendAt->lt(now($userTimezone))) {
            return;
        }

        Reminder::create([
            'user_id' => $user->id,
            'type' => 'tasks_pending',
            'channel' => $user->email_notifications_enabled ? 'both' : 'in_app',
            'title' => "📚 {$pendingCount} task" . ($pendingCount > 1 ? 's' : '') . " left today",
            'message' => "You still have {$pendingCount} study task" . ($pendingCount > 1 ? 's' : '') . " for today. A quick session can make a big difference!",
            'payload' => [
                'pending_count' => $pendingCount,
            ],
            'send_at' => $sendAt,
            'status' => 'pending',
        ]);
    }

    public function notifyBehavioral(User $user, string $type, string $title, string $message, array $payload = []): bool
    {
        if (!$user->reminders_enabled && !$user->email_notifications_enabled) {
            return false;
        }

        // Prevent duplicate behavioral notifications on the same day
        $userTimezone = $user->timezone ?? config('app.timezone');
        $existsToday = Reminder::where('user_id', $user->id)
            ->where('type', $type)
            ->whereDate('send_at', Carbon::today($userTimezone))
            ->exists();

        if ($existsToday) {
            return false;
        }

        Reminder::create([
            'user_id' => $user->id,
            'type' => $type,
            'channel' => $user->email_notifications_enabled ? 'both' : 'in_app',
            'title' => $title,
            'message' => $message,
            'payload' => $payload,
            'send_at' => now(), // Send immediately
            'status' => 'pending',
        ]);

        return true;
    }

    public function sendDueReminders(): int
    {
        $dueReminders = Reminder::due()->with('user')->get();
        $sentCount = 0;

        foreach ($dueReminders as $reminder) {
            if (!$reminder->user || !$reminder->user->reminders_enabled) {
                $reminder->dismiss();
                continue;
            }

            // Send in-app notification
            try {
                $reminder->user->notify(new \App\Notifications\StudyReminderNotification($reminder));
                $reminder->markSent();
                $sentCount++;
            } catch (\Exception $e) {
                \Log::error('Failed to send reminder notification', [
                    'reminder_id' => $reminder->id,
                    'user_id' => $reminder->user_id,
                    'error' => $e->getMessage(),
                ]);
            }

            // Also send email if channel is 'both' or 'email'
            if (in_array($reminder->channel, ['both', 'email'])
                && $reminder->user->email_notifications_enabled
                && !$reminder->email_sent
            ) {
                try {
                    \Illuminate\Support\Facades\Mail::to($reminder->user->email)
                        ->queue(new \App\Mail\StudyReminderMail($reminder, $reminder->user->name));

                    $reminder->update([
                        'email_sent' => true,
                        'email_sent_at' => now(),
                    ]);

                    $reminder->user->update([
                        'last_email_sent_at' => now(),
                        'emails_sent_today' => ($reminder->user->emails_sent_today ?? 0) + 1,
                    ]);
                } catch (\Exception $e) {
                    \Log::error('Failed to send reminder email', [
                        'reminder_id' => $reminder->id,
                        'user_id' => $reminder->user_id,
                        'error' => $e->getMessage(),
                    ]);
                }
            }
        }

        return $sentCount;
    }

    public function getRecentReminders(User $user, int $limit = 10): \Illuminate\Database\Eloquent\Collection
    {
        return Reminder::where('user_id', $user->id)
            ->whereIn('status', ['sent', 'read'])
            ->orderBy('send_at', 'desc')
            ->limit($limit)
            ->get();
    }

    public function getUnreadCount(User $user): int
    {
        return Reminder::where('user_id', $user->id)
            ->where('status', 'sent')
            ->whereNull('read_at')
            ->count();
    }

    protected function getNudgeTitle(int $streak): string
    {
        if ($streak >= 7) return "🏆 {$streak}-day streak! Keep it going!";
        if ($streak >= 3) return "🔥 {$streak} days strong!";
        if ($streak >= 1) return "📖 Time to study!";
        return "👋 Ready to learn today?";
    }

    protected function getNudgeMessage(int $streak, User $user): string
    {
        if ($streak >= 7) {
            return "Amazing! You've been studying for {$streak} days straight. One session today keeps the progress going!";
        }
        if ($streak >= 3) {
            return "You're building a great habit! Don't break your {$streak}-day streak—just 15 minutes today.";
        }
        if ($streak >= 1) {
            return "You studied yesterday—keep the progress! A quick review session goes a long way.";
        }
        return "Start your study journey today. Even a short session helps build lasting knowledge.";
    }
}
