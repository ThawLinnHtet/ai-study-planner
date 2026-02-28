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
        Schema::create('study_sessions', function (Blueprint $table) {
            $table->id();

            $table->foreignId('user_id')
                ->constrained()
                ->cascadeOnDelete();

            $table->foreignId('study_plan_id')
                ->nullable()
                ->constrained('study_plans')
                ->nullOnDelete();

            $table->foreignId('learning_path_id')
                ->nullable()
                ->constrained('learning_paths')
                ->nullOnDelete();
                
            $table->unsignedInteger('day_number')->nullable();

            $table->timestamp('started_at')->index();

            $table->unsignedInteger('duration_minutes')->nullable();

            $table->string('type')->default('study');
            $table->string('status'); 

            $table->text('notes')->nullable();
            $table->json('meta')->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->index(['user_id', 'started_at']);
            $table->index(['study_plan_id', 'started_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('study_sessions');
    }
};
