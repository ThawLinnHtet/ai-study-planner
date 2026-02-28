<?php

namespace App\Notifications;

use App\Models\Reminder;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Messages\DatabaseMessage;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Broadcasting\PrivateChannel;

class StudyReminderNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public Reminder $reminder
    ) {}

    public function via($notifiable): array
    {
        $channels = ['database', 'broadcast'];
        
        // Add email channel if user has email notifications enabled
        if ($notifiable->email_notifications_enabled ?? false) {
            $channels[] = 'mail';
        }

        return $channels;
    }

    public function toDatabase($notifiable): array
    {
        return [
            'reminder_id' => $this->reminder->id,
            'type' => $this->reminder->type,
            'title' => $this->reminder->title,
            'message' => $this->reminder->message,
            'payload' => $this->reminder->payload,
            'icon' => $this->getIcon(),
            'action_url' => $this->getActionUrl(),
        ];
    }

    public function toBroadcast($notifiable): BroadcastMessage
    {
        return new BroadcastMessage([
            'id' => $this->reminder->id,
            'type' => $this->reminder->type,
            'title' => $this->reminder->title,
            'message' => $this->reminder->message,
            'icon' => $this->getIcon(),
            'action_url' => $this->getActionUrl(),
            'created_at' => now()->toISOString(),
        ]);
    }

    public function toMail($notifiable): MailMessage
    {
        return (new \App\Mail\StudyReminderMail($this->reminder, $notifiable->name))
            ->to($notifiable->email);
    }

    public function broadcastOn(): array
    {
        return [new PrivateChannel("user.{$this->reminder->user_id}")];
    }

    public function broadcastAs(): string
    {
        return 'study.reminder';
    }

    private function getIcon(): string
    {
        return match ($this->reminder->type) {
            'daily_nudge' => '📘',
            'streak_risk' => '🔥',
            'life_refill' => '💖',
            'tasks_pending' => '🔔',
            'streak_milestone' => '🏆',
            'streak_break_encouragement' => '🌟',
            default => '📚',
        };
    }

    private function getActionUrl(): string
    {
        return match ($this->reminder->type) {
            'daily_nudge', 'tasks_pending' => route('study-planner'),
            'streak_risk' => route('study-planner'),
            'life_refill' => route('study-planner'),
            'streak_milestone' => route('dashboard'),
            default => route('dashboard'),
        };
    }
}
