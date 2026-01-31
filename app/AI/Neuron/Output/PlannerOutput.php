<?php

namespace App\AI\Neuron\Output;

use NeuronAI\StructuredOutput\SchemaProperty;

class Session
{
    #[SchemaProperty(title: 'Subject', description: 'The name of the subject to study (e.g. Mathematics)', required: true)]
    public string $subject;

    #[SchemaProperty(title: 'Topic', description: 'The specific topic or chapter to focus on', required: true)]
    public string $topic;

    #[SchemaProperty(title: 'Duration', description: 'Number of minutes for this session', required: true)]
    public int $duration_minutes;

    #[SchemaProperty(title: 'Focus Level', description: 'Intensity level required: low, medium, or high', required: true)]
    public string $focus_level;
}

class DayPlan
{
    /** @var \App\AI\Neuron\Output\Session[] */
    #[SchemaProperty(description: 'List of study sessions for the day', required: true)]
    public array $sessions;
}

class PlannerOutput
{
    /** @var array<string, \App\AI\Neuron\Output\DayPlan> */
    #[SchemaProperty(
        title: 'Weekly Schedule',
        description: 'Map of day names (Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday) to their respective plans. Keys MUST be full English day names.',
        required: true
    )]
    public array $schedule;

    #[SchemaProperty(title: 'Strategy Summary', description: 'A brief explanation of why this schedule was designed this way.', required: true)]
    public string $strategy_summary;
}
