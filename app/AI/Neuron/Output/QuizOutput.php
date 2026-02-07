<?php

namespace App\AI\Neuron\Output;

use NeuronAI\StructuredOutput\SchemaProperty;

class QuizOption
{
    #[SchemaProperty(description: 'Option label (A, B, C, D)', required: true)]
    public string $label;

    #[SchemaProperty(description: 'Option text', required: true)]
    public string $text;
}

class QuizQuestion
{
    #[SchemaProperty(description: 'The question text', required: true)]
    public string $question;

    /** @var \App\AI\Neuron\Output\QuizOption[] */
    #[SchemaProperty(description: 'Array of 4 options (A, B, C, D)', required: true)]
    public array $options;

    #[SchemaProperty(description: 'Correct answer label (A, B, C, or D)', required: true)]
    public string $correct_answer;

    #[SchemaProperty(description: 'Brief explanation of why the answer is correct', required: true)]
    public string $explanation;
}

class QuizOutput
{
    /** @var \App\AI\Neuron\Output\QuizQuestion[] */
    #[SchemaProperty(description: 'Array of quiz questions', required: true)]
    public array $questions;
}
