<?php

require_once 'vendor/autoload.php';

// Test basic quiz generation
try {
    echo "Testing QuizService...\n";
    
    // Create a mock user
    $user = new class {
        public $id = 1;
        
        public function studyPlans() {
            return new class {
                public function where($field, $value) {
                    return new class {
                        public function value($field) {
                            return 1;
                        }
                    };
                }
            };
        }
    };
    
    // Test QuizService
    $quizService = new \App\Services\QuizService();
    echo "QuizService created successfully\n";
    
    // Test quiz generation
    $quiz = $quizService->generateForSession($user, 'Test Subject', 'Test Topic');
    echo "Quiz generated successfully\n";
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    echo "Trace: " . $e->getTraceAsString() . "\n";
}
