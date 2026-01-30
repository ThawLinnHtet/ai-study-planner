<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('onboarding_completed')->default(false)->after('remember_token');
            $table->unsignedSmallInteger('daily_study_hours')->nullable()->after('onboarding_completed');
            $table->string('learning_style')->nullable()->after('daily_study_hours');
            $table->string('timezone')->nullable()->after('learning_style');

            $table->index(['onboarding_completed']);
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['onboarding_completed']);
            $table->dropColumn([
                'onboarding_completed',
                'daily_study_hours',
                'learning_style',
                'timezone',
            ]);
        });
    }
};
