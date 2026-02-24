<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reminders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('type'); // streak_risk, lives_refilled, tasks_pending, daily_nudge
            $table->string('channel')->default('in_app'); // in_app, email, push
            $table->text('title');
            $table->text('message');
            $table->json('payload')->nullable();
            $table->timestamp('send_at');
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->string('status')->default('pending'); // pending, sent, read, dismissed
            $table->boolean('email_sent')->default(false);
            $table->timestamp('email_sent_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status', 'send_at']);
            $table->index(['status', 'send_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reminders');
    }
};
