<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Fortify\TwoFactorAuthenticatable;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, TwoFactorAuthenticatable;
    use Notifiable {
        notify as laravelNotify;
    }

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'onboarding_completed',
        'is_generating_plan',
        'generating_status',
        'daily_study_hours',
        'timezone',
        'subjects',
        'onboarding_step',
        'study_goal',
        'subject_difficulties',
        'subject_session_durations',
        'study_streak',
        'last_study_date',
        'reminders_enabled',
        'reminder_window',
        'reminder_window_inferred',
        'email_notifications_enabled',
        'email_preferences',
        'last_email_sent_at',
        'emails_sent_today',
        'subject_start_dates',
        'subject_end_dates',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'two_factor_secret',
        'two_factor_recovery_codes',
        'remember_token',
        'productivity_peak',
        'learning_style',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'two_factor_confirmed_at' => 'datetime',
            'onboarding_completed' => 'boolean',
            'is_generating_plan' => 'boolean',
            'subjects' => 'array',
            'onboarding_step' => 'integer',
            'subject_difficulties' => 'array',
            'subject_session_durations' => 'array',
            'last_study_date' => 'datetime',
            'email_preferences' => 'array',
            'last_email_sent_at' => 'datetime',
            'subject_start_dates' => 'array',
            'subject_end_dates' => 'array',
            'daily_study_hours' => 'integer',
        ];
    }

    /**
     * Block access to removed fields
     */
    public function getAttribute($key)
    {
        if (in_array($key, ['productivity_peak', 'learning_style'])) {
            throw new \Exception("Field '{$key}' has been removed from the system.");
        }
        
        return parent::getAttribute($key);
    }

    public function subjectRecords(): HasMany
    {
        return $this->hasMany(Subject::class);
    }

    public function studyPlans(): HasMany
    {
        return $this->hasMany(StudyPlan::class);
    }

    public function notifications()
    {
        return $this->hasMany(\App\Models\Notification::class);
    }

    public function unreadNotifications()
    {
        return $this->notifications()->unread();
    }

    public function notify($notification)
    {
        // Create notification using custom model if it has toDatabase method
        if (method_exists($notification, 'toDatabase')) {
            $data = $notification->toDatabase($this);
            return \App\Models\Notification::create($data);
        }

        // Fallback to standard Laravel notification delivery (e.g. for ResetPassword)
        return $this->laravelNotify($notification);
    }

    public function quizzes(): HasMany
    {
        return $this->hasMany(Quiz::class);
    }

    public function quizResults(): HasMany
    {
        return $this->hasMany(QuizResult::class);
    }

    public function learningPaths(): HasMany
    {
        return $this->hasMany(LearningPath::class);
    }

    public function studySessions(): HasMany
    {
        return $this->hasMany(StudySession::class);
    }

    public function chatThreads(): HasMany
    {
        return $this->hasMany(ChatThread::class);
    }

    /**
     * Send the password reset notification.
     *
     * @param  string  $token
     * @return void
     */
    public function sendPasswordResetNotification($token)
    {
        $this->notify(new \App\Notifications\Auth\ResetPassword($token));
    }
}
