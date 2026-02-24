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

    #[SchemaProperty(title: 'Key Topics', description: 'Major concepts or high-level milestones for this session (3-4 items)', required: true)]
    public array $key_topics = [];

    #[SchemaProperty(title: 'Sub Topics', description: 'Granular, specific sub-concepts or technical details to cover (5-8 items)', required: true)]
    public array $sub_topics = [];

    #[SchemaProperty(title: 'Resources', description: 'Recommended external resources. ONLY include verified, direct URLs (YouTube, Khan Academy, Wikipedia, documentation). If unsure of a direct URL, generate a YouTube search URL in the format: https://www.youtube.com/results?search_query=[subject+topic+tutorial]', required: true)]
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
