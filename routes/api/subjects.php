<?php

use App\Http\Controllers\Api\SubjectController;
use Illuminate\Support\Facades\Route;

// Simplified subject API routes
Route::get('/subjects/search', [SubjectController::class, 'search']);
Route::post('/subjects', [SubjectController::class, 'store']);
Route::get('/subjects', [SubjectController::class, 'index']);
