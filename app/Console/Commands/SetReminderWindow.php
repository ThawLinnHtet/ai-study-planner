<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;

class SetReminderWindow extends Command
{
    protected $signature = 'reminders:set-window {user : User ID} {window : morning|afternoon|evening|night}';
    protected $description = 'Force reminder settings for a given user to simplify testing';

    public function handle(): int
    {
        $userId = (int) $this->argument('user');
        $window = $this->argument('window');

        if (! in_array($window, ['morning', 'afternoon', 'evening', 'night'], true)) {
            $this->error('Window must be one of: morning, afternoon, evening, night.');
            return self::FAILURE;
        }

        $user = User::find($userId);

        if (! $user) {
            $this->error("User {$userId} not found.");
            return self::FAILURE;
        }

        $user->forceFill([
            'reminders_enabled' => true,
            'onboarding_completed' => true,
            'reminder_window' => $window,
            'reminder_window_inferred' => false,
        ])->save();

        $this->info("Reminder window for user {$user->id} set to {$window} (reminders enabled).");

        return self::SUCCESS;
    }
}
