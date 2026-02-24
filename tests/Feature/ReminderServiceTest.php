<?php

use App\Models\Reminder;
use App\Models\User;
use App\Services\ActivityTrackingService;
use App\Services\ReminderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;

uses(RefreshDatabase::class);

class FakeActivityTrackingService extends ActivityTrackingService
{
    public function __construct(
        protected bool $studiedToday = false,
        protected int $windowHour = 19,
    ) {}

    public function hasStudiedToday(User $user): bool
    {
        return $this->studiedToday;
    }

    public function getWindowHour(string $window): int
    {
        return $this->windowHour;
    }
}

it('schedules a daily nudge when the user has not studied today', function () {
    Carbon::setTestNow('2026-02-01 08:00:00');

    $user = User::factory()->create([
        'reminders_enabled' => true,
        'reminder_window' => 'morning',
        'study_streak' => 2,
        'last_study_date' => Carbon::yesterday(),
    ]);

    $this->app->instance(ActivityTrackingService::class, new FakeActivityTrackingService(false, 10));

    $service = app(ReminderService::class);
    $service->scheduleRemindersForUser($user);

    $this->assertDatabaseHas('reminders', [
        'user_id' => $user->id,
        'type' => 'daily_nudge',
        'status' => 'pending',
    ]);
});

it('schedules a streak risk reminder only once per day', function () {
    Carbon::setTestNow('2026-02-01 18:00:00');

    $user = User::factory()->create([
        'reminders_enabled' => true,
        'reminder_window' => 'evening',
        'study_streak' => 4,
        'last_study_date' => Carbon::yesterday(),
    ]);

    $this->app->instance(ActivityTrackingService::class, new FakeActivityTrackingService(false, 17));

    $service = app(ReminderService::class);
    $service->scheduleStreakRiskReminder($user);
    $service->scheduleStreakRiskReminder($user); // second call should noop

    $this->assertDatabaseCount('reminders', 1);

    $reminder = Reminder::first();
    expect($reminder->type)->toBe('streak_risk');
    expect($reminder->send_at->format('H:i'))->toBe('19:00');
});

it('schedules pending task reminders once per day', function () {
    Carbon::setTestNow('2026-02-01 09:00:00');

    $user = User::factory()->create([
        'reminders_enabled' => true,
    ]);

    $service = app(ReminderService::class);

    $service->scheduleTasksPendingReminder($user, 3);
    $service->scheduleTasksPendingReminder($user, 2);

    $this->assertDatabaseCount('reminders', 1);

    $stored = Reminder::first();
    expect($stored->type)->toBe('tasks_pending');
    expect($stored->message)->toContain('3 study task');
});

it('marks due reminders as sent when dispatching', function () {
    Carbon::setTestNow('2026-02-01 21:00:00');

    $user = User::factory()->create([
        'reminders_enabled' => true,
    ]);

    Reminder::create([
        'user_id' => $user->id,
        'type' => 'daily_nudge',
        'channel' => 'in_app',
        'title' => 'Test',
        'message' => 'Ping',
        'payload' => [],
        'send_at' => Carbon::now()->subMinutes(5),
        'status' => 'pending',
    ]);

    Reminder::create([
        'user_id' => $user->id,
        'type' => 'daily_nudge',
        'channel' => 'in_app',
        'title' => 'Future',
        'message' => 'Later',
        'payload' => [],
        'send_at' => Carbon::now()->addHour(),
        'status' => 'pending',
    ]);

    $service = app(ReminderService::class);
    $sentCount = $service->sendDueReminders();

    expect($sentCount)->toBe(1);
    expect(Reminder::where('status', 'sent')->count())->toBe(1);
    expect(Reminder::where('status', 'pending')->count())->toBe(1);
});
