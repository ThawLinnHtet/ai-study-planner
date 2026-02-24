<?php

use App\Http\Controllers\Auth\GoogleAuthController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\ReminderController;
use App\Http\Middleware\EnsureOnboarded;
use Inertia\Inertia;
use Laravel\Fortify\Features;

// Include debug routes
require __DIR__.'/debug_quiz.php';
require __DIR__.'/debug_quiz_generate.php';

Route::get('/', function () {
    return Inertia::render('landing');
})->name('home');

Route::get('/welcome', function () {
    return Inertia::render('welcome', [
        'canRegister' => Features::enabled(Features::registration()),
    ]);
})->name('welcome');

Route::get('auth/google', [GoogleAuthController::class, 'redirect'])->name('auth.google.redirect');
Route::get('auth/google/callback', [GoogleAuthController::class, 'callback'])->name('auth.google.callback');

Route::get('dashboard', [\App\Http\Controllers\StudyPlanController::class, 'dashboard'])
    ->middleware(['auth', 'verified', EnsureOnboarded::class])
    ->name('dashboard');

Route::middleware(['auth', 'verified', EnsureOnboarded::class])->group(function () {
    Route::get('study-planner', [\App\Http\Controllers\LearningPathController::class, 'index'])
        ->name('study-planner');

    // Learning Path routes
    Route::prefix('learning-path')->group(function () {
        Route::post('enroll', [\App\Http\Controllers\LearningPathController::class, 'enroll'])
            ->name('learning-path.enroll');
        Route::get('{learningPath}/check-delete', [\App\Http\Controllers\LearningPathController::class, 'checkDelete'])
            ->name('learning-path.check-delete');
        Route::delete('{learningPath}', [\App\Http\Controllers\LearningPathController::class, 'destroy'])
            ->name('learning-path.destroy');
        Route::post('{learningPath}/complete-day', [\App\Http\Controllers\LearningPathController::class, 'completeDay'])
            ->name('learning-path.complete-day');
        Route::post('{learningPath}/uncomplete-day', [\App\Http\Controllers\LearningPathController::class, 'uncompleteDay'])
            ->name('learning-path.uncomplete-day');
        Route::post('{learningPath}/skip-day', [\App\Http\Controllers\LearningPathController::class, 'skipDay'])
            ->name('learning-path.skip-day');
    });

    // Legacy study plan routes (kept for backward compatibility)
    Route::post('study-plan/rebalance', [\App\Http\Controllers\StudyPlanController::class, 'rebalance'])
        ->name('study-plan.rebalance');

    Route::post('study-plan/toggle-session', [\App\Http\Controllers\StudyPlanController::class, 'toggleSession'])
        ->name('study-plan.toggle-session');

    Route::post('study-plan/renew-cycle', [\App\Http\Controllers\StudyPlanController::class, 'renewCycle'])
        ->name('study-plan.renew-cycle');

    Route::post('study-plan/complete-quiz/{resultId}', [\App\Http\Controllers\StudyPlanController::class, 'completeQuiz'])
        ->name('study-plan.complete-quiz');

    Route::prefix('reminders')->group(function () {
        Route::get('/', [ReminderController::class, 'index'])->name('reminders.index');
        Route::post('{reminder}/read', [ReminderController::class, 'read'])->name('reminders.read');
        Route::post('{reminder}/dismiss', [ReminderController::class, 'dismiss'])->name('reminders.dismiss');
        Route::post('dismiss-all', [ReminderController::class, 'dismissAll'])->name('reminders.dismiss_all');
        Route::post('toggle', [ReminderController::class, 'toggleReminders'])->name('reminders.toggle');
        Route::post('demo', [ReminderController::class, 'demo'])->name('reminders.demo');
    });

    
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

    Route::get('quiz/practice', function () {
        return Inertia::render('quiz-practice', [
            'subject' => request('subject', 'General'),
            'topic' => request('topic', 'Practice'),
        ]);
    })->name('quiz.practice');

    Route::prefix('quiz')->group(function () {
        Route::post('generate', [\App\Http\Controllers\QuizController::class, 'generate'])
            ->name('quiz.generate');
        Route::post('submit', [\App\Http\Controllers\QuizController::class, 'submit'])
            ->name('quiz.submit');
        Route::get('history', [\App\Http\Controllers\QuizController::class, 'history'])
            ->name('quiz.history');
        Route::get('results/{id}', [\App\Http\Controllers\QuizController::class, 'show'])
            ->name('quiz.show');
        Route::post('results/{id}/retake', [\App\Http\Controllers\QuizController::class, 'retake'])
            ->name('quiz.retake');
        Route::delete('{id}/abandon', [\App\Http\Controllers\QuizController::class, 'abandon'])
            ->name('quiz.abandon');
    });

    Route::post('activity/track', [\App\Http\Controllers\ActivityController::class, 'track'])
        ->name('activity.track');

    Route::get('progress', [\App\Http\Controllers\ProgressController::class, 'index'])
        ->name('progress');
});

require __DIR__.'/onboarding.php';
require __DIR__.'/settings.php';
