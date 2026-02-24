<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class LearningPath extends Model
{
    use SoftDeletes;

    protected $table = 'learning_paths';

    protected $fillable = [
        'user_id',
        'subject_name',
        'start_date',
        'end_date',
        'total_days',
        'current_day',
        'status',
        'curriculum',
        'difficulty',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
            'curriculum' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function studySessions(): HasMany
    {
        return $this->hasMany(StudySession::class);
    }

    /**
     * Get the curriculum data for a specific day number.
     */
    public function getDayData(int $dayNumber): ?array
    {
        $curriculum = $this->curriculum ?? [];
        return $curriculum[(string) $dayNumber] ?? null;
    }

    /**
     * Get the status (locked/unlocked/completed) for a given day.
     */
    public function getDayStatus(int $dayNumber): string
    {
        if ($dayNumber < $this->current_day) {
            return 'completed';
        }

        if ($dayNumber === $this->current_day) {
            return 'unlocked';
        }

        return 'locked';
    }

    /**
     * Check if all sessions for the current day are completed.
     */
    public function isCurrentDayComplete(): bool
    {
        $completedSessions = $this->studySessions()
            ->where('day_number', $this->current_day)
            ->where('status', 'completed')
            ->count();

        return $completedSessions > 0;
    }

    /**
     * Skip the current day and move to the next.
     */
    public function skipCurrentDay(): bool
    {
        // Mark as skipped in curriculum if possible
        $curriculum = $this->curriculum;
        $dayToSkip = $this->current_day;
        
        if (isset($curriculum[(string) $dayToSkip])) {
            $curriculum[(string) $dayToSkip]['skipped'] = true;
            $this->curriculum = $curriculum;
            $this->save();
        }

        return $this->forceAdvance();
    }

    /**
     * Advance to the next day if current day is complete.
     */
    public function advanceDay(): bool
    {
        if (!$this->isCurrentDayComplete()) {
            return false;
        }

        return $this->forceAdvance();
    }

    /**
     * Force increment the day number regardless of completion.
     */
    protected function forceAdvance(): bool
    {
        if ($this->current_day >= $this->total_days) {
            $this->update(['status' => 'completed', 'current_day' => $this->total_days]);
            return true;
        }

        $this->increment('current_day');
        return true;
    }

    /**
     * Calculate the completion percentage.
     */
    public function getProgressPercent(): float
    {
        if ($this->total_days === 0) {
            return 0;
        }

        $completedDays = max(0, $this->current_day - 1);

        // If current day is complete, include it
        if ($this->isCurrentDayComplete()) {
            $completedDays = $this->current_day;
        }

        return round(($completedDays / $this->total_days) * 100, 1);
    }

    /**
     * Check if the enrollment is behind schedule (based on real calendar dates).
     */
    public function isBehindSchedule(): bool
    {
        if ($this->status !== 'active') {
            return false;
        }

        $daysSinceStart = now()->startOfDay()->diffInDays($this->start_date, true);
        $expectedDay = min($this->total_days, (int) $daysSinceStart + 1);

        return $this->current_day < $expectedDay;
    }

    /**
     * Count how many sessions have been completed across all days.
     */
    public function completedSessionsCount(): int
    {
        return $this->studySessions()
            ->where('status', 'completed')
            ->count();
    }
}
