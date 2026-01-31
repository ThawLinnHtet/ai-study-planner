<?php

namespace App\AI\Neuron\Output;

use NeuronAI\StructuredOutput\SchemaProperty;

class OptimizerOutput
{
    /** @var array<string, \App\AI\Neuron\Output\DayPlan> */
    #[SchemaProperty(description: 'Updated schedule following the same structure as PlannerOutput', required: true)]
    public array $optimized_schedule;

    #[SchemaProperty(description: 'List of specific modifications made', required: true)]
    public array $change_log;

    #[SchemaProperty(description: 'Why the new plan is better', required: true)]
    public string $predicted_improvement;
}
