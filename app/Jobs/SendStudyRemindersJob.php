<?php

namespace App\Jobs;

use App\Services\ReminderService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendStudyRemindersJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 300; // 5 minutes timeout
    public $tries = 3;

    public function __construct(
        public ?int $userId = null
    ) {}

    public function handle(ReminderService $reminderService): void
    {
        // Process reminders for specific user or all users
        if ($this->userId) {
            $user = \App\Models\User::find($this->userId);
            if ($user && $user->reminders_enabled && $user->onboarding_completed) {
                $reminderService->scheduleRemindersForUser($user);
                $reminderService->scheduleStreakRiskReminder($user);
            }
        } else {
            // Process all eligible users
            $users = \App\Models\User::where('reminders_enabled', true)
                ->where('onboarding_completed', true)
                ->whereNotNull('reminder_window')
                ->get();

            foreach ($users as $user) {
                $reminderService->scheduleRemindersForUser($user);
                $reminderService->scheduleStreakRiskReminder($user);
            }
        }

        // Send all due reminders
        $reminderService->sendDueReminders();
    }

    public function failed(\Throwable $exception): void
    {
        \Log::error('SendStudyRemindersJob failed', [
            'user_id' => $this->userId,
            'error' => $exception->getMessage(),
            'trace' => $exception->getTraceAsString(),
        ]);
    }
}
