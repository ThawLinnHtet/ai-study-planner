<?php

namespace App\AI\Neuron\Output;

class CurriculumDay
{
    public string $topic;
    public string $level; // beginner, intermediate, advanced
    public int $duration_minutes;
    public string $focus_level; // low, medium, high
    public array $key_topics = [];
    public array $sub_topics = [];
    public array $resources = [];
}

class CurriculumOutput
{
    /**
     * Map of day numbers to curriculum data.
     * e.g. { "1": { topic, level, duration_minutes, ... }, "2": { ... }, ... }
     */
    public array $curriculum;

    public string $strategy_summary = '';
}
