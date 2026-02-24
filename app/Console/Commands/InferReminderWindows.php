<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\ActivityTrackingService;
use Illuminate\Console\Command;

class InferReminderWindows extends Command
{
    protected $signature = 'reminders:infer-windows';
    protected $description = 'Analyze user activity logs and infer optimal reminder windows';

    public function handle(ActivityTrackingService $activityService): int
    {
        $users = User::where('reminders_enabled', true)
            ->where('onboarding_completed', true)
            ->get();

        $inferred = 0;

        foreach ($users as $user) {
            $window = $activityService->inferReminderWindow($user);
            if ($window) {
                $inferred++;
                $this->line("User #{$user->id}: inferred window → {$window}");
            }
        }

        $this->info("Inferred reminder windows for {$inferred} users.");

        return self::SUCCESS;
    }
}
