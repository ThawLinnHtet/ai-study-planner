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
        Schema::table('study_plans', function (Blueprint $table) {
            $table->timestamp('prevent_rebalance_until')->nullable()->after('generated_plan');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('study_plans', function (Blueprint $table) {
            $table->dropColumn('prevent_rebalance_until');
        });
    }
};
