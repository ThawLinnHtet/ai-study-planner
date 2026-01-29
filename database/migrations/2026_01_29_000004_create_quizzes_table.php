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
        Schema::create('quizzes', function (Blueprint $table) {
            $table->id();

            $table->foreignId('user_id')
                ->constrained()
                ->cascadeOnDelete();

            $table->foreignId('subject_id')
                ->nullable()
                ->constrained('subjects')
                ->nullOnDelete();

            $table->foreignId('study_plan_id')
                ->nullable()
                ->constrained('study_plans')
                ->nullOnDelete();

            $table->string('title');
            $table->text('description')->nullable();

            $table->string('difficulty')->nullable();
            $table->unsignedSmallInteger('total_questions')->nullable();

            $table->json('questions')->nullable();
            $table->json('settings')->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->index(['user_id', 'created_at']);
            $table->index(['user_id', 'subject_id']);
            $table->index(['study_plan_id', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('quizzes');
    }
};
