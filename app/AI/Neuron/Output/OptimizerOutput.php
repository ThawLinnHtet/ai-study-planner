<?php

namespace App\AI\Neuron\Output;

use NeuronAI\StructuredOutput\SchemaProperty;

class OptimizerOutput
{
    #[SchemaProperty(description: 'Updated schedule with day names as keys, each containing sessions array', required: true)]
    public array $optimized_schedule;

    #[SchemaProperty(description: 'List of specific modifications made', required: true)]
    public array $change_log = [];

    #[SchemaProperty(description: 'Why the new plan is better', required: true)]
    public string $predicted_improvement = '';
}
