<?php

use Illuminate\Support\Facades\Route;
use App\Http\Middleware\EnsureOnboarded;
use Inertia\Inertia;
use Laravel\Fortify\Features;

Route::get('/', function () {
    return Inertia::render('welcome', [
        'canRegister' => Features::enabled(Features::registration()),
    ]);
})->name('home');

Route::get('dashboard', [\App\Http\Controllers\StudyPlanController::class, 'dashboard'])
    ->middleware(['auth', 'verified', EnsureOnboarded::class])
    ->name('dashboard');

Route::middleware(['auth', 'verified', EnsureOnboarded::class])->group(function () {
    Route::get('study-planner', [\App\Http\Controllers\StudyPlanController::class, 'index'])
        ->name('study-planner');

    Route::post('study-plan/rebalance', [\App\Http\Controllers\StudyPlanController::class, 'rebalance'])
        ->name('study-plan.rebalance');

    Route::post('study-plan/toggle-session', [\App\Http\Controllers\StudyPlanController::class, 'toggleSession'])
        ->name('study-plan.toggle-session');

    
    Route::prefix('ai-tutor')->group(function () {
        Route::post('new-thread', [\App\Http\Controllers\AiTutorController::class, 'newThread'])
            ->name('ai-tutor.new-thread');

        Route::get('threads', [\App\Http\Controllers\AiTutorController::class, 'threads'])
            ->name('ai-tutor.threads');

        Route::get('threads/{threadId}', [\App\Http\Controllers\AiTutorController::class, 'messages'])
            ->name('ai-tutor.messages');

        Route::post('send', [\App\Http\Controllers\AiTutorController::class, 'send'])
            ->name('ai-tutor.send');

        Route::delete('threads/{threadId}', [\App\Http\Controllers\AiTutorController::class, 'deleteThread'])
            ->name('ai-tutor.delete');
    });

    Route::get('quizzes', function () {
        return Inertia::render('quizzes');
    })->name('quizzes');

    Route::get('progress', [\App\Http\Controllers\ProgressController::class, 'index'])
        ->name('progress');
});

require __DIR__.'/onboarding.php';
require __DIR__.'/settings.php';
