<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class StudyPlan extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'user_id',
        'subject_id',
        'title',
        'goal',
        'starts_on',
        'ends_on',
        'target_hours_per_week',
        'status',
        'preferences',
        'generated_plan',
        'prevent_rebalance_until',
    ];

    protected function casts(): array
    {
        return [
            'starts_on' => 'date',
            'ends_on' => 'date',
            'preferences' => 'array',
            'generated_plan' => 'array',
            'prevent_rebalance_until' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }

    public function studySessions(): HasMany
    {
        return $this->hasMany(StudySession::class);
    }

    public function quizzes(): HasMany
    {
        return $this->hasMany(Quiz::class);
    }
}
