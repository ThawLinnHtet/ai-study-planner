<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\ReminderService;
use Illuminate\Console\Command;

class SendStudyReminders extends Command
{
    protected $signature = 'reminders:send {--user=}';
    protected $description = 'Schedule and send due study reminders to users';

    public function handle(ReminderService $reminderService): int
    {
        $userId = $this->option('user');

        $query = User::where('reminders_enabled', true)
            ->where('onboarding_completed', true)
            ->whereNotNull('reminder_window');

        if ($userId) {
            $query->whereKey($userId);
        }

        $users = $query->get();

        if ($users->isEmpty()) {
            $this->warn('No eligible users found for reminders.');
            return self::SUCCESS;
        }

        foreach ($users as $user) {
            $reminderService->scheduleRemindersForUser($user);
            $reminderService->scheduleStreakRiskReminder($user);
        }

        // Step 2: Send all due reminders
        $sentCount = $reminderService->sendDueReminders();

        $this->info("Processed {$users->count()} user(s). Sent {$sentCount} reminders.");

        return self::SUCCESS;
    }
}
