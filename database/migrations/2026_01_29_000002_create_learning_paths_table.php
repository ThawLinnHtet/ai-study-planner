<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('learning_paths', function (Blueprint $table) {
            $table->id();

            $table->foreignId('user_id')
                ->constrained()
                ->cascadeOnDelete();

            $table->string('subject_name');
            $table->date('start_date');
            $table->date('end_date');
            $table->unsignedInteger('total_days');
            $table->unsignedInteger('current_day')->default(1);

            $table->string('status')->default('active'); // active, completed, paused

            // AI-generated day-by-day curriculum (beginner → advanced)
            // Structure: { "1": { topic, subtopics, resources, duration_minutes, level }, ... }
            $table->json('curriculum')->nullable();

            // Exam support was dropped by 2026_02_24_165716_drop_exam_columns_from_learning_paths_table

            // Difficulty and session preferences
            $table->unsignedTinyInteger('difficulty')->default(2); // 1=easy, 2=medium, 3=hard

            $table->timestamps();
            $table->softDeletes();

            $table->index(['user_id', 'status']);
            $table->index(['user_id', 'subject_name']);
        });

        // study_sessions table alterations moved to 2026_01_29_000003_create_study_sessions_table.php constraint
    }

    public function down(): void
    {


        Schema::dropIfExists('learning_paths');
    }
};
