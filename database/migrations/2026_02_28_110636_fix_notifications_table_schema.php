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
        Schema::table('notifications', function (Blueprint $table) {
            // Keep original columns for Laravel internal compatibility but add custom ones
            if (!Schema::hasColumn('notifications', 'user_id')) {
                $table->foreignId('user_id')->nullable()->after('id')->constrained()->cascadeOnDelete();
            }
            if (!Schema::hasColumn('notifications', 'title')) {
                $table->string('title')->nullable()->after('type');
            }
            if (!Schema::hasColumn('notifications', 'message')) {
                $table->text('message')->nullable()->after('title');
            }
            if (!Schema::hasColumn('notifications', 'is_read')) {
                $table->boolean('is_read')->default(false)->after('data');
            }
            if (!Schema::hasColumn('notifications', 'email_sent')) {
                $table->boolean('email_sent')->default(false)->after('is_read');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->dropColumn(['user_id', 'title', 'message', 'is_read', 'email_sent']);
        });
    }
};
