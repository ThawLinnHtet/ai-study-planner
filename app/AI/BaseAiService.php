<?php

namespace App\AI;

use Illuminate\Support\Facades\Http;
use Exception;

abstract class BaseAiService
{
    protected string $apiKey;
    protected string $baseUrl;

    /**
     * Create a new AI service instance.
     */
    public function __construct()
    {
        $this->apiKey = config('services.openrouter.key') ?? '';
        $this->baseUrl = config('services.openrouter.base_url') ?? 'https://openrouter.ai/api/v1';
    }

    /**
     * Send a request to the AI provider.
     *
     * @param array $payload
     * @return array
     * @throws Exception
     */
    protected function sendRequest(array $payload): array
    {
        if (empty($this->apiKey)) {
            throw new Exception('OpenRouter API key is not configured.');
        }

        $response = Http::withHeaders([
            'Authorization' => 'Bearer ' . $this->apiKey,
            'Content-Type' => 'application/json',
            'HTTP-Referer' => config('app.url'),
            'X-Title' => config('app.name'),
        ])->post($this->baseUrl . '/chat/completions', $payload);

        if ($response->failed()) {
            throw new Exception('AI Request failed: ' . $response->body());
        }

        return $response->json();
    }

    /**
     * Each service must implement its main logic.
     */
    abstract public function execute(array $data);
}
