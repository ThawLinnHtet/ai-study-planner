<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->json('subjects')->nullable()->after('timezone');
            $table->json('exam_dates')->nullable()->after('subjects');
            $table->unsignedTinyInteger('onboarding_step')->default(1)->after('exam_dates');
            $table->string('study_goal')->nullable()->after('learning_style');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'subjects',
                'exam_dates',
                'onboarding_step',
                'study_goal',
            ]);
        });
    }
};
