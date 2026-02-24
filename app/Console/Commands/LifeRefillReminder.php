<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\ReminderService;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

class LifeRefillReminder extends Command
{
    protected $signature = 'reminders:life-refill {user : User ID} {--wait=0 : Minutes from now before reminder fires}';
    protected $description = 'Schedule a quiz life-refill reminder for a specific user';

    public function handle(ReminderService $reminderService): int
    {
        $user = User::find($this->argument('user'));

        if (! $user) {
            $this->error('User not found.');
            return self::FAILURE;
        }

        $wait = max(0, (int) $this->option('wait'));
        $sendAt = Carbon::now()->addMinutes($wait);

        $user->forceFill([
            'reminders_enabled' => true,
            'onboarding_completed' => true,
            'reminder_window' => $user->reminder_window ?? 'evening',
        ])->save();

        $reminderService->scheduleLifeRefillReminder($user, $sendAt);

        $this->info("Life refill reminder scheduled for user {$user->id} at {$sendAt->toDateTimeString()}.");

        return self::SUCCESS;
    }
}
