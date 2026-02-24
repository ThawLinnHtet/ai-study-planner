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
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');
            $table->string('avatar')->nullable();
            
            // Authentication & OAuth
            $table->string('auth_provider')->nullable();
            $table->string('google_id')->nullable();
            $table->string('google_email')->nullable();
            $table->string('google_avatar')->nullable();
            $table->timestamp('google_connected_at')->nullable();
            
            // Onboarding & Preferences
            $table->boolean('onboarding_completed')->default(false);
            $table->unsignedTinyInteger('onboarding_step')->default(1);
            $table->string('timezone')->nullable();
            $table->string('study_goal')->nullable();
            $table->unsignedSmallInteger('daily_study_hours')->nullable();
            
            // Subject Data (JSON)
            $table->json('subjects')->nullable();
            $table->json('subject_difficulties')->nullable();
            $table->json('subject_session_durations')->nullable();
            $table->json('subject_start_dates')->nullable();
            $table->json('subject_end_dates')->nullable();
            
            // Generation State
            $table->boolean('is_generating_plan')->default(false);
            $table->string('generating_status')->nullable();
            
            // Streaks & Activity
            $table->unsignedInteger('study_streak')->default(0);
            $table->date('last_study_date')->nullable();
            
            // Notifications & Reminders
            $table->boolean('reminders_enabled')->default(true);
            $table->string('reminder_window')->nullable();
            $table->boolean('reminder_window_inferred')->default(false);
            
            // Emails
            $table->boolean('email_notifications_enabled')->default(true);
            $table->json('email_preferences')->nullable();
            $table->timestamp('last_email_sent_at')->nullable();
            $table->unsignedInteger('emails_sent_today')->default(0);

            $table->rememberToken();
            $table->timestamps();
        });

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('users');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('sessions');
    }
};
