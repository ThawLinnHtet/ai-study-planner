<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('quiz_results', function (Blueprint $table) {
            $table->id();

            $table->foreignId('user_id')
                ->constrained()
                ->cascadeOnDelete();

            $table->foreignId('quiz_id')
                ->constrained('quizzes')
                ->cascadeOnDelete();

            $table->foreignId('study_plan_id')
                ->nullable()
                ->constrained('study_plans')
                ->nullOnDelete();

            $table->foreignId('study_session_id')
                ->nullable()
                ->constrained('study_sessions')
                ->nullOnDelete();

            $table->unsignedSmallInteger('score')->nullable();
            $table->unsignedSmallInteger('max_score')->nullable();
            $table->decimal('percentage', 5, 2)->nullable();

            $table->unsignedSmallInteger('correct_count')->nullable();
            $table->unsignedSmallInteger('incorrect_count')->nullable();
            $table->unsignedSmallInteger('skipped_count')->nullable();

            $table->unsignedInteger('duration_seconds')->nullable();

            $table->json('answers')->nullable();
            $table->json('meta')->nullable();

            $table->timestamp('taken_at')->useCurrent()->index();
            $table->timestamps();

            $table->index(['user_id', 'taken_at']);
            $table->index(['quiz_id', 'taken_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('quiz_results');
    }
};
