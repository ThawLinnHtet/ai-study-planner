<?php

namespace App\AI\Neuron\Output;

use NeuronAI\StructuredOutput\SchemaProperty;

class Insight
{
    #[SchemaProperty(description: 'Observation detail', required: true)]
    public string $detail;

    #[SchemaProperty(description: 'Impact on student progress', required: true)]
    public string $significance;
}

class AnalyzerOutput
{
    /** @var \App\AI\Neuron\Output\Insight[] */
    #[SchemaProperty(description: 'Patterns and observations', required: true)]
    public array $insights;

    #[SchemaProperty(description: 'Subject mastery key-value pairs (subject => percentage)', required: true)]
    public array $subject_mastery;

    #[SchemaProperty(description: 'Immediate specific actions', required: true)]
    public array $recommendations;
}
