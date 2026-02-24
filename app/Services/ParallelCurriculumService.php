<?php

namespace App\Services;

use App\AI\Neuron\CurriculumAgent;
use App\AI\Neuron\Output\CurriculumOutput;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ParallelCurriculumService
{
    protected $agent;

    public function __construct(\App\AI\Neuron\NeuronService $neuron)
    {
        $this->agent = $neuron->curriculum();
    }

    /**
     * Generate multiple curricula in parallel.
     * 
     * @param array $subjectsData Array of ['subject' => string, 'total_days' => int, ...]
     * @return array Map of subject names to CurriculumOutput objects (or null on failure)
     */
    public function generateBatch(array $subjectsData): array
    {
        $apiKey = config('services.openrouter.key');
        $model = config('services.openrouter.model', 'google/gemini-2.0-flash-001');

        $responses = Http::pool(fn ($pool) => 
            collect($subjectsData)->map(function ($data) use ($pool, $apiKey, $model) {
                $prompt = $this->agent->getPrompt($data);
                
                return $pool->as($data['subject'])->withToken($apiKey)
                    ->timeout(120)
                    ->post('https://openrouter.ai/api/v1/chat/completions', [
                        'model' => $model,
                        'messages' => [
                            ['role' => 'system', 'content' => $this->agent->instructions()],
                            ['role' => 'user', 'content' => $prompt],
                        ],
                        'response_format' => ['type' => 'json_object'],
                    ]);
            })->all()
        );

        $results = [];
        foreach ($responses as $subject => $response) {
            if ($response->ok()) {
                try {
                    $content = $response->json('choices.0.message.content');
                    $cleaned = $this->cleanResponse($content);
                    $data = json_decode($cleaned, true);
                    
                    if (json_last_error() === JSON_ERROR_NONE) {
                        $output = new CurriculumOutput();
                        $output->curriculum = $data['curriculum'] ?? [];
                        $output->strategy_summary = $data['strategy_summary'] ?? '';
                        $results[$subject] = $output;
                        continue;
                    }
                    Log::error("Failed to parse JSON for {$subject}: " . json_last_error_msg());
                } catch (\Exception $e) {
                    Log::error("Failed to process response for {$subject}: " . $e->getMessage());
                }
            } else {
                Log::error("AI request failed for {$subject}: " . $response->body());
            }
            $results[$subject] = null;
        }

        return $results;
    }

    protected function cleanResponse(string $response): string
    {
        $response = preg_replace('/^```json\s*/', '', $response);
        $response = preg_replace('/```\s*$/', '', $response);
        return trim($response);
    }
}
