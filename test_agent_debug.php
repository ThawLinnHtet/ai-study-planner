<?php

require_once 'vendor/autoload.php';

// Test the QuizAgent directly
try {
    echo "Testing QuizAgent...\n";
    
    $agent = \App\AI\Neuron\QuizAgent::make();
    echo "QuizAgent created successfully\n";
    
    $output = $agent->generate('Test Subject', 'Test Topic', 2, 'medium');
    echo "Quiz generated successfully\n";
    echo "Number of questions: " . count($output->questions) . "\n";
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    echo "File: " . $e->getFile() . ":" . $e->getLine() . "\n";
}
