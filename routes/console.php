<?php

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('neuron:test', function () {
    $this->info('Starting Neuron AI Test...');

    $service = new \App\AI\Neuron\NeuronService;

    $dummyData = [
        'subjects' => ['Mathematics', 'Physics'],
        'subject_difficulties' => ['Mathematics' => 3, 'Physics' => 2],
        'exam_dates' => ['Mathematics' => '2026-06-01', 'Physics' => '2026-06-15'],
        'productivity_peak' => 'morning',
        'daily_study_hours' => 3,
        'learning_style' => ['visual', 'reading'],
        'current_day' => 'Monday',
        'current_date' => '2026-06-01',
    ];

    try {
        $this->comment('Requesting plan from PlannerAgent...');
        $result = $service->execute($dummyData);

        $this->info('Success! Response received:');
        $this->line(json_encode($result, JSON_PRETTY_PRINT));
    } catch (\Exception $e) {
        $this->error('Test failed: '.$e->getMessage());
    }
})->purpose('Quickly test the Neuron AI PlannerAgent');

// Schedule auto-purge of soft-deleted AI messages daily at midnight
Schedule::command('ai:purge-deleted --days=30')->daily();
