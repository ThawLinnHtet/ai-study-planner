<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

// Load API route files
Route::group([], function () {
    require __DIR__.'/api/subjects.php';
});

// Health check for API
Route::get('/health', function () {
    return response()->json(['status' => 'ok']);
});
