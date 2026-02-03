<?php

use App\Http\Controllers\OnboardingController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth'])->group(function () {
    Route::get('onboarding', [OnboardingController::class, 'show'])->name('onboarding.show');
    Route::post('onboarding', [OnboardingController::class, 'store'])->name('onboarding.store');

    // Handle subjects selection from autocomplete page
    Route::post('onboarding/subjects', [OnboardingController::class, 'storeSubjects'])->name('onboarding.subjects');

    Route::get('onboarding/{any}', function () {
        return redirect('/onboarding');
    })->where('any', '.*');
});
