<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\BehavioralNotificationService;
use Illuminate\Console\Command;

class TestBehaviorEmails extends Command
{
    protected $signature = 'emails:test-behavior {--user= : User ID to test (default: 1)}';
    protected $description = 'Test behavioral emails and notifications for a specific user';

    public function handle(BehavioralNotificationService $notificationService): int
    {
        $userId = $this->option('user') ?: 1;
        $user = User::find($userId);

        if (!$user) {
            $this->error("User not found: {$userId}");
            return self::FAILURE;
        }

        $this->info("Checking behavior triggers for user: {$user->name} ({$user->email})...");

        // Temporarily force checks even if they might normally be skipped
        $sentCount = $notificationService->processUserBehavior($user);

        if ($sentCount > 0) {
            $this->info("Generated {$sentCount} behavioral notification(s)!");
            $this->info("Run 'php artisan reminders:send' and 'php artisan queue:work' to process and send them.");
        } else {
            $this->info("No triggers fired. The user might not meet the criteria (e.g. not inactive enough, no milestone hit, or already sent today).");
        }

        return self::SUCCESS;
    }
}
