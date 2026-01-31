<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QuizResult extends Model
{
    protected $fillable = [
        'user_id',
        'quiz_id',
        'study_plan_id',
        'study_session_id',
        'score',
        'max_score',
        'percentage',
        'correct_count',
        'incorrect_count',
        'skipped_count',
        'duration_seconds',
        'answers',
        'meta',
        'taken_at',
    ];

    protected function casts(): array
    {
        return [
            'percentage' => 'decimal:2',
            'answers' => 'array',
            'meta' => 'array',
            'taken_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function quiz(): BelongsTo
    {
        return $this->belongsTo(Quiz::class);
    }

    public function studyPlan(): BelongsTo
    {
        return $this->belongsTo(StudyPlan::class);
    }

    public function studySession(): BelongsTo
    {
        return $this->belongsTo(StudySession::class);
    }
}
