<?php

namespace App\Jobs;

use App\Services\BehaviorEmailService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendBehaviorEmailsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 300;
    public $tries = 3;

    public function __construct(
        public ?int $userId = null
    ) {}

    public function handle(\App\Services\BehavioralNotificationService $notificationService): void
    {
        if ($this->userId) {
            $user = \App\Models\User::find($this->userId);
            if ($user && ($user->email_notifications_enabled || $user->reminders_enabled) && $user->onboarding_completed) {
                $notificationService->processUserBehavior($user);
            }
        } else {
            $notificationService->processAllUsers();
        }
    }


    public function failed(\Throwable $exception): void
    {
        \Log::error('SendBehaviorEmailsJob failed', [
            'user_id' => $this->userId,
            'error' => $exception->getMessage(),
            'trace' => $exception->getTraceAsString(),
        ]);
    }
}
