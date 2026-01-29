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
        Schema::create('ai_messages', function (Blueprint $table) {
            $table->id();

            $table->foreignId('user_id')
                ->constrained()
                ->cascadeOnDelete();

            $table->foreignId('study_plan_id')
                ->nullable()
                ->constrained('study_plans')
                ->nullOnDelete();

            $table->uuid('thread_id')->index();

            $table->string('role');
            $table->text('content');

            $table->string('provider')->nullable();
            $table->string('model')->nullable();

            $table->unsignedInteger('prompt_tokens')->nullable();
            $table->unsignedInteger('completion_tokens')->nullable();
            $table->unsignedInteger('total_tokens')->nullable();

            $table->json('meta')->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->index(['user_id', 'study_plan_id', 'created_at']);
            $table->index(['user_id', 'thread_id', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ai_messages');
    }
};
