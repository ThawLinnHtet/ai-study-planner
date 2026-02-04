<?php

namespace App\AI\Providers;

use NeuronAI\Providers\OpenAI\OpenAI;

class OpenRouter extends OpenAI
{
    /**
     * The main URL of the provider API.
     */
    protected string $baseUri = 'https://openrouter.ai/api/v1';

    public function __construct(
        protected string $key,
        protected string $model,
        protected array $parameters = [],
        protected bool $strict_response = false,
        protected ?\NeuronAI\Providers\HttpClientOptions $httpOptions = null,
    ) {
        if ($this->model === 'google/gemini-2.0-flash') {
            $this->model = 'google/gemini-2.0-flash-001';
        }
        parent::__construct(
            key: $this->key,
            model: $this->model,
            parameters: $this->parameters,
            strict_response: $this->strict_response,
            httpOptions: $this->httpOptions
        );
    }
}
