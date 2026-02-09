<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Log;

Route::post('/debug-quiz-generate', function (Request $request) {
    try {
        Log::info('Debug quiz generation started');
        
        $validated = $request->validate([
            'subject' => ['required', 'string'],
            'topic' => ['required', 'string'],
            'forceNew' => ['boolean'],
        ]);
        
        Log::info('Request validated', $validated);
        
        $user = $request->user();
        Log::info('User found: ' . $user->id);
        
        $forceNew = $validated['forceNew'] ?? false;
        Log::info('Force new: ' . $forceNew);
        
        // Test the problematic query
        if (!$forceNew) {
            Log::info('Checking for existing quiz...');
            
            try {
                $existingQuiz = \App\Models\Quiz::where('user_id', $user->id)
                    ->whereJsonContains('settings->subject', $validated['subject'])
                    ->whereJsonContains('settings->topic', $validated['topic'])
                    ->where('created_at', '>=', now()->subHours(24))
                    ->whereDoesntHave('results', function ($q) {
                        $q->where('percentage', '>=', 80);
                    })
                    ->latest()
                    ->first();
                    
                Log::info('Existing quiz query completed');
            } catch (Exception $e) {
                Log::error('Quiz query failed: ' . $e->getMessage());
                return response()->json(['error' => 'Quiz query failed: ' . $e->getMessage()], 500);
            }
        }
        
        Log::info('Proceeding to quiz generation');
        
        $quizService = new \App\Services\QuizService();
        $quiz = $quizService->generateForSession($user, $validated['subject'], $validated['topic']);
        
        Log::info('Quiz generated successfully');
        
        return response()->json(['success' => true, 'quiz_id' => $quiz->id]);
        
    } catch (Exception $e) {
        Log::error('Debug quiz generation failed: ' . $e->getMessage());
        Log::error('Trace: ' . $e->getTraceAsString());
        return response()->json(['error' => $e->getMessage()], 500);
    }
});
