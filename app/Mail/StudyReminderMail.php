<?php

namespace App\Mail;

use App\Models\Reminder;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class StudyReminderMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public Reminder $reminder,
        public string $userName = ''
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: $this->reminder->title,
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.study-reminder',
            with: [
                'reminder' => $this->reminder,
                'userName' => $this->userName,
                'icon' => $this->getIcon(),
                'actionUrl' => $this->getActionUrl(),
                'streak' => $this->reminder->payload['streak'] ?? 0,
            ]
        );
    }

    public function attachments(): array
    {
        return [];
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
        $baseUrl = config('app.url');
        return match ($this->reminder->type) {
            'daily_nudge', 'tasks_pending' => $baseUrl . '/study-planner',
            'streak_risk' => $baseUrl . '/study-planner',
            'life_refill' => $baseUrl . '/quiz',
            'streak_milestone' => $baseUrl . '/dashboard',
            default => $baseUrl . '/dashboard',
        };
    }
}
