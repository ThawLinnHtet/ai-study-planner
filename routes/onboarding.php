<?php

use App\Http\Controllers\OnboardingController;
use App\Http\Middleware\EnsureOnboarded;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', EnsureOnboarded::class])->group(function () {
    Route::get('onboarding', [OnboardingController::class, 'show'])->name('onboarding.show');
    Route::post('onboarding', [OnboardingController::class, 'store'])->name('onboarding.store');

    Route::get('onboarding/{any}', function () {
        return redirect('/onboarding');
    })->where('any', '.*');
});
