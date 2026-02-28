<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\ReminderService;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

class LifeRefillReminder extends Command
{
    protected $signature = 'reminders:life-refill {user? : Optional User ID} {--wait=0 : Minutes from now before reminder fires}';
    protected $description = 'Schedule a quiz life-refill reminder for a specific user or automatically for eligible users';

    public function handle(ReminderService $reminderService): int
    {
        $userId = $this->argument('user');
        $wait = max(0, (int) $this->option('wait'));
        $sendAt = Carbon::now()->addMinutes($wait);

        if ($userId) {
            $user = User::find($userId);
            if (! $user) {
                $this->error('User not found.');
                return self::FAILURE;
            }
            $this->processUser($user, $reminderService, $sendAt);
            $this->info("Life refill reminder scheduled for user {$user->id} at {$sendAt->toDateTimeString()}.");
        } else {
            $this->info('Finding users who need a life refill reminder...');
            
            // Find users who failed a quiz at least 30 minutes ago (match LIFE_REFILL_MINUTES)
            // We use 'taken_at' from quizResults meta or taken_at column if available
            $eligibleUsers = User::where('reminders_enabled', true)
                ->whereHas('quizResults', function ($query) {
                    $query->where('percentage', '<', 70) // failed quiz
                          ->where('taken_at', '>=', now()->subHours(6)) // Only look at recent failures
                          ->where('taken_at', '<=', now()->subMinutes(30)); 
                })
                ->get();
            
            foreach ($eligibleUsers as $user) {
                // Get the timestamp of their latest failed quiz
                $latestFailure = $user->quizResults()
                    ->where('percentage', '<', 70)
                    ->latest('taken_at')
                    ->first()?->taken_at;

                if (!$latestFailure) continue;

                // Check if we've already scheduled/sent a reminder for this failure
                $alreadyReminded = \App\Models\Reminder::where('user_id', $user->id)
                    ->where('type', 'life_refill')
                    ->where('created_at', '>=', $latestFailure)
                    ->exists();

                if (!$alreadyReminded) {
                    $this->processUser($user, $reminderService, $sendAt);
                    $this->info("Scheduled life refill for user {$user->id}.");
                }
            }
            $this->info("Done searching for life refills.");
        }

        return self::SUCCESS;
    }

    private function processUser(User $user, ReminderService $reminderService, Carbon $sendAt): void
    {
        $reminderService->scheduleLifeRefillReminder($user, $sendAt);
    }
}
