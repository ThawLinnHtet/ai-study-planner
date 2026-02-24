<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Reminder extends Model
{
    protected $fillable = [
        'user_id',
        'type',
        'channel',
        'title',
        'message',
        'payload',
        'send_at',
        'sent_at',
        'read_at',
        'status',
        'email_sent',
        'email_sent_at',
    ];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'send_at' => 'datetime',
            'sent_at' => 'datetime',
            'read_at' => 'datetime',
            'email_sent' => 'boolean',
            'email_sent_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    public function scopeDue($query)
    {
        return $query->where('status', 'pending')->where('send_at', '<=', now());
    }

    public function scopeUnread($query)
    {
        return $query->whereIn('status', ['pending', 'sent'])->whereNull('read_at');
    }

    public function markSent(): void
    {
        $this->update(['status' => 'sent', 'sent_at' => now()]);
    }

    public function markRead(): void
    {
        $this->update(['status' => 'read', 'read_at' => now()]);
    }

    public function dismiss(): void
    {
        $this->update(['status' => 'dismissed']);
    }
}
