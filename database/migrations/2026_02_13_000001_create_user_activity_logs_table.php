<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_activity_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('event_type'); // app_opened, study_session_started, study_session_completed, task_completed, quiz_started, quiz_completed
            $table->json('payload')->nullable(); // extra context (subject, topic, etc.)
            $table->timestamp('occurred_at');
            $table->timestamps();

            $table->index(['user_id', 'event_type', 'occurred_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_activity_logs');
    }
};
