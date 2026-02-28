<?php

namespace App\Console\Commands;

use App\Models\Reminder;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

class DemoReminders extends Command
{
    protected $signature = 'reminders:demo {user : User ID}';
    protected $description = 'Create sample reminders for a user to demo the notification dropdown';

    public function handle(): int
    {
        $user = User::find($this->argument('user'));

        if (! $user) {
            $this->error('User not found.');
            return self::FAILURE;
        }

        $user->forceFill([
            'reminders_enabled' => true,
            'onboarding_completed' => true,
            'reminder_window' => $user->reminder_window ?? 'evening',
        ])->save();

        $now = Carbon::now();

        Reminder::where('user_id', $user->id)
            ->whereIn('status', ['pending', 'sent'])
            ->delete();

        $streak = $user->study_streak ?: 1;

        $sampleReminders = [
            [
                'type' => 'daily_nudge',
                'title' => '📘 15-minute review time',
                'message' => 'Stay on your streak—finish one quick session today.',
            ],
            [
                'type' => 'streak_risk',
                'title' => "🔥 Don't lose your {$streak}-day streak",
                'message' => 'One more study session keeps your streak alive!',
            ],
            [
                'type' => 'tasks_pending',
                'title' => '🔔 Tasks waiting',
                'message' => 'You still have 2 study tasks open for today.',
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

        $this->info("Seeded demo reminders for user {$user->id}. Refresh the frontend to see them.");

        return self::SUCCESS;
    }
}
