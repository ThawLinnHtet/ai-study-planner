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

    #[SchemaProperty(title: 'Key Topics', description: 'Key concepts for this session', required: true)]
    public array $key_topics = [];

    #[SchemaProperty(title: 'Resources', description: 'Recommended external resources for this session', required: true)]
    public array $resources = [];
}

class SubjectResource
{
    #[SchemaProperty(title: 'Title', description: 'Resource name', required: true)]
    public string $title;

    #[SchemaProperty(title: 'URL', description: 'Public resource link', required: true)]
    public string $url;

    #[SchemaProperty(title: 'Type', description: 'Resource type such as article, video, course, or textbook', required: true)]
    public string $type;
}

class PlannerOutput
{
    #[SchemaProperty(
        title: 'Weekly Schedule',
        description: 'Map of day names (Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday) to their respective session lists. Keys MUST be full English day names and values MUST be arrays of session objects.',
        required: true
    )]
    public array $schedule;

    #[SchemaProperty(title: 'Strategy Summary', description: 'A brief explanation of why this schedule was designed this way.', required: true)]
    public string $strategy_summary = '';
}
