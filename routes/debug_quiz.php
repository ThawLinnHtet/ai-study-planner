<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/debug-quiz', function () {
    try {
        echo "Testing QuizAgent in Laravel context...\n";
        
        $agent = \App\AI\Neuron\QuizAgent::make();
        echo "QuizAgent created successfully\n";
        
        $output = $agent->generate('Test Subject', 'Test Topic', 2, 'medium');
        echo "Quiz generated successfully\n";
        echo "Number of questions: " . count($output->questions) . "\n";
        
        return "Quiz generation test successful!";
        
    } catch (Exception $e) {
        echo "Error: " . $e->getMessage() . "\n";
        echo "File: " . $e->getFile() . ":" . $e->getLine() . "\n";
        return "Quiz generation test failed: " . $e->getMessage();
    }
});
