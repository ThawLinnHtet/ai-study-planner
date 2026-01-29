<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Laravel\Fortify\Features;

Route::get('/', function () {
    return Inertia::render('welcome', [
        'canRegister' => Features::enabled(Features::registration()),
    ]);
})->name('home');

Route::get('dashboard', function () {
    return Inertia::render('dashboard');
})->middleware(['auth', 'verified'])->name('dashboard');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('study-planner', function () {
        return Inertia::render('study-planner');
    })->name('study-planner');

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

require __DIR__.'/settings.php';
