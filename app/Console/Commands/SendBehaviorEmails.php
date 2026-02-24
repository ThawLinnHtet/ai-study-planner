<?php

namespace App\Console\Commands;

use App\Services\BehavioralNotificationService;
use Illuminate\Console\Command;

class SendBehaviorEmails extends Command
{
    protected $signature = 'emails:send-behavior {--user= : Process a specific user ID}';
    protected $description = 'Analyze user behavior and send automatic email reminders';

    public function handle(BehavioralNotificationService $notificationService): int
    {
        $userId = $this->option('user');

        if ($userId) {
            $user = \App\Models\User::find($userId);
            if (!$user) {
                $this->error("User with ID {$userId} not found.");
                return self::FAILURE;
            }

            $this->info("Processing behavior notifications for: {$user->name} ({$user->email})");
            $sent = $notificationService->processUserBehavior($user);
        } else {
            $this->info('Processing behavior-based notifications for all eligible users...');
            $sent = $notificationService->processAllUsers();
        }

        $this->info("Done. Sent {$sent} email(s).");
        return self::SUCCESS;
    }
}
