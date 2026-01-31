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



    Route::get('ai-tutor', function () {
        return Inertia::render('ai-tutor');
    })->name('ai-tutor');

    Route::get('quizzes', function () {
        return Inertia::render('quizzes');
    })->name('quizzes');

    Route::get('progress', function () {
        return Inertia::render('progress');
    })->name('progress');
});

require __DIR__.'/onboarding.php';
require __DIR__.'/settings.php';
