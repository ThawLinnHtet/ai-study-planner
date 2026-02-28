<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Models\Reminder;
use Illuminate\Console\Command;

class TestStudyReminders extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:test-study-reminders {email?}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Trigger a test study reminder (in-app + email) for a specific user.';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $email = $this->argument('email');
        if (!$email) {
            $user = User::first();
        } else {
            $user = User::where('email', $email)->first();
        }

        if (!$user) {
            $this->error("User not found.");
            return;
        }

        // Enable notifications for this user just in case
        $user->reminders_enabled = true;
        $user->email_notifications_enabled = true;
        $user->save();

        // Create a fake due reminder to test the service
        $reminder = Reminder::create([
            'user_id' => $user->id,
            'type' => 'daily_nudge',
            'channel' => 'both', // Send to both email and app bell
            'title' => '🔔 Test Study Reminder',
            'message' => 'This is a test notification to check if your bells and emails are working!',
            'payload' => [],
            'send_at' => now()->subMinutes(5), // Make it "due" immediately
            'status' => 'pending',
        ]);

        $this->info("Created fake due reminder. Dispatching now...");

        // Call the service method that actually sends out pending notifications
        $service = app(\App\Services\ReminderService::class);
        $sentCount = $service->sendDueReminders();

        $this->info("Success! Sent {$sentCount} due notifications to {$user->email}.");
    }
}
