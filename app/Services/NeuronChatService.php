<?php

namespace App\Services;

use App\Models\AiMessage;
use App\Models\StudyPlan;
use App\Models\StudySession;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class NeuronChatService
{
    public function __construct(
        protected UserProgressService $progress,
    ) {
    }

    public function newThreadId(): string
    {
        return (string) Str::uuid();
    }

    public function listThreads(User $user, int $limit = 20): array
    {
        $rows = AiMessage::query()
            ->selectRaw('thread_id, MAX(created_at) as last_at')
            ->where('user_id', $user->id)
            ->whereNull('deleted_at')
            ->groupBy('thread_id')
            ->orderByDesc('last_at')
            ->limit($limit)
            ->get();

        $threads = [];
        foreach ($rows as $row) {
            $last = AiMessage::query()
                ->where('user_id', $user->id)
                ->where('thread_id', $row->thread_id)
                ->whereNull('deleted_at')
                ->orderByDesc('created_at')
                ->first(['content', 'created_at']);

            if (! $last) {
                continue;
            }

            $threads[] = [
                'thread_id' => $row->thread_id,
                'updated_at' => $last->created_at?->toIso8601String(),
                'preview' => Str::limit((string) $last->content, 80),
            ];
        }

        return $threads;
    }

    public function getThreadMessages(User $user, string $threadId, int $limit = 50): array
    {
        return AiMessage::query()
            ->where('user_id', $user->id)
            ->where('thread_id', $threadId)
            ->whereNull('deleted_at')
            ->orderBy('created_at')
            ->limit($limit)
            ->get(['id', 'role', 'content', 'created_at'])
            ->map(fn ($m) => [
                'id' => $m->id,
                'role' => $m->role,
                'content' => $m->content,
                'created_at' => $m->created_at?->toIso8601String(),
            ])
            ->all();
    }

    public function deleteThread(User $user, string $threadId): void
    {
        AiMessage::query()
            ->where('user_id', $user->id)
            ->where('thread_id', $threadId)
            ->whereNull('deleted_at')
            ->update(['deleted_at' => now()]);
    }

    public function sendStream(User $user, string $message, ?string $threadId = null): \Generator
    {
        $threadId = $threadId ?: $this->newThreadId();

        $activePlanId = StudyPlan::query()
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->value('id');

        AiMessage::create([
            'user_id' => $user->id,
            'study_plan_id' => $activePlanId,
            'thread_id' => $threadId,
            'role' => 'user',
            'content' => $message,
            'provider' => null,
            'model' => null,
            'meta' => null,
        ]);

        $history = AiMessage::query()
            ->where('user_id', $user->id)
            ->where('thread_id', $threadId)
            ->whereNull('deleted_at')
            ->orderByDesc('created_at')
            ->limit(20)
            ->get(['role', 'content'])
            ->reverse()
            ->values();

        $context = $this->buildContext($user);
        $system = $this->systemPrompt($context);

        $messages = [
            ['role' => 'system', 'content' => $system],
        ];

        foreach ($history as $h) {
            $role = (string) $h->role;
            if (! in_array($role, ['user', 'assistant', 'system'], true)) {
                $role = 'user';
            }
            $messages[] = [
                'role' => $role,
                'content' => (string) $h->content,
            ];
        }

        $payload = [
            'model' => config('services.openrouter.model', 'google/gemini-2.0-flash-001'),
            'messages' => $messages,
            'temperature' => 0.4,
            'max_tokens' => 800,
            'stream' => true,
        ];

        $key = (string) (config('services.openrouter.key') ?? '');
        if ($key === '') {
            throw new \RuntimeException('OpenRouter API key is not configured.');
        }

        $baseUrl = (string) (config('services.openrouter.base_url') ?? 'https://openrouter.ai/api/v1');

        yield json_encode(['type' => 'thread_id', 'thread_id' => $threadId])."\n\n";

        $fullContent = '';
        $client = new \GuzzleHttp\Client();

        try {
            $response = $client->post(rtrim($baseUrl, '/').'/chat/completions', [
                'headers' => [
                    'Authorization' => 'Bearer '.$key,
                    'Content-Type' => 'application/json',
                    'HTTP-Referer' => (string) config('app.url'),
                    'X-Title' => (string) config('app.name'),
                ],
                'json' => $payload,
                'stream' => true,
            ]);

            $body = $response->getBody();

            while (! $body->eof()) {
                $line = '';
                while (! $body->eof()) {
                    $char = $body->read(1);
                    if ($char === "\n") {
                        break;
                    }
                    $line .= $char;
                }

                $line = trim($line);
                if ($line === '' || $line === 'data: [DONE]') {
                    continue;
                }

                if (str_starts_with($line, 'data: ')) {
                    $jsonStr = substr($line, 6);
                    $data = json_decode($jsonStr, true);

                    if (isset($data['choices'][0]['delta']['content'])) {
                        $chunk = $data['choices'][0]['delta']['content'];
                        $fullContent .= $chunk;
                        yield json_encode(['type' => 'content', 'content' => $chunk])."\n\n";
                    }
                }
            }

            AiMessage::create([
                'user_id' => $user->id,
                'study_plan_id' => $activePlanId,
                'thread_id' => $threadId,
                'role' => 'assistant',
                'content' => $fullContent,
                'provider' => 'openrouter',
                'model' => (string) config('services.openrouter.model', 'google/gemini-2.0-flash-001'),
                'meta' => ['context' => $context],
            ]);

            yield json_encode(['type' => 'done'])."\n\n";
        } catch (\Exception $e) {
            yield json_encode(['type' => 'error', 'message' => $e->getMessage()])."\n\n";
        }
    }

    public function send(User $user, string $message, ?string $threadId = null): array
    {
        $threadId = $threadId ?: $this->newThreadId();

        $activePlanId = StudyPlan::query()
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->value('id');

        AiMessage::create([
            'user_id' => $user->id,
            'study_plan_id' => $activePlanId,
            'thread_id' => $threadId,
            'role' => 'user',
            'content' => $message,
            'provider' => null,
            'model' => null,
            'meta' => null,
        ]);

        $history = AiMessage::query()
            ->where('user_id', $user->id)
            ->where('thread_id', $threadId)
            ->whereNull('deleted_at')
            ->orderByDesc('created_at')
            ->limit(20)
            ->get(['role', 'content'])
            ->reverse()
            ->values();

        $context = $this->buildContext($user);

        $system = $this->systemPrompt($context);

        $messages = [
            ['role' => 'system', 'content' => $system],
        ];

        foreach ($history as $h) {
            $role = (string) $h->role;
            if (! in_array($role, ['user', 'assistant', 'system'], true)) {
                $role = 'user';
            }
            $messages[] = [
                'role' => $role,
                'content' => (string) $h->content,
            ];
        }

        $payload = [
            'model' => config('services.openrouter.model', 'google/gemini-2.0-flash-001'),
            'messages' => $messages,
            'temperature' => 0.4,
            'max_tokens' => 800,
        ];

        $key = (string) (config('services.openrouter.key') ?? '');
        if ($key === '') {
            throw new \RuntimeException('OpenRouter API key is not configured.');
        }

        $baseUrl = (string) (config('services.openrouter.base_url') ?? 'https://openrouter.ai/api/v1');

        $response = Http::withHeaders([
            'Authorization' => 'Bearer '.$key,
            'Content-Type' => 'application/json',
            'HTTP-Referer' => (string) config('app.url'),
            'X-Title' => (string) config('app.name'),
        ])->post(rtrim($baseUrl, '/').'/chat/completions', $payload);

        if ($response->failed()) {
            throw new \RuntimeException('AI Request failed: '.$response->body());
        }

        $json = $response->json();
        $assistantContent = (string) data_get($json, 'choices.0.message.content', '');

        $usage = (array) (data_get($json, 'usage', []) ?? []);
        $promptTokens = isset($usage['prompt_tokens']) ? (int) $usage['prompt_tokens'] : null;
        $completionTokens = isset($usage['completion_tokens']) ? (int) $usage['completion_tokens'] : null;
        $totalTokens = isset($usage['total_tokens']) ? (int) $usage['total_tokens'] : null;

        AiMessage::create([
            'user_id' => $user->id,
            'study_plan_id' => $activePlanId,
            'thread_id' => $threadId,
            'role' => 'assistant',
            'content' => $assistantContent,
            'provider' => 'openrouter',
            'model' => (string) config('services.openrouter.model', 'google/gemini-2.0-flash-001'),
            'prompt_tokens' => $promptTokens,
            'completion_tokens' => $completionTokens,
            'total_tokens' => $totalTokens,
            'meta' => [
                'context' => $context,
            ],
        ]);

        return [
            'thread_id' => $threadId,
            'assistant' => [
                'role' => 'assistant',
                'content' => $assistantContent,
            ],
        ];
    }

    protected function systemPrompt(array $context): string
    {
        $ctx = json_encode($context, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        return "You are Neuron, a context-aware AI tutor inside a study planner app.\n\n".
            "Goals:\n".
            "- Help the student decide what to study next, explain concepts, and keep them motivated.\n".
            "- Use the provided app context to be personalized and practical.\n".
            "- Ask 1-2 clarifying questions when needed.\n\n".
            "Rules:\n".
            "- Be concise but high-signal.\n".
            "- When recommending actions, give a short checklist.\n".
            "- Never invent user data; rely on context.\n".
            "- If context is missing, say what you need.\n\n".
            "APP_CONTEXT_JSON:\n".
            $ctx;
    }

    protected function buildContext(User $user): array
    {
        $activePlan = StudyPlan::query()
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->orderByDesc('created_at')
            ->first();

        $today = Carbon::today();
        $todayName = $today->format('l');

        $planContext = null;
        if ($activePlan) {
            $gp = $activePlan->generated_plan ?? [];
            if (! is_array($gp)) {
                $gp = [];
            }

            $schedule = $gp['schedule'] ?? [];
            $weeks = $gp['weeks'] ?? null;
            if (is_array($weeks) && $activePlan->starts_on) {
                $startsOn = Carbon::parse($activePlan->starts_on)->startOfDay();
                $daysSince = $startsOn->diffInDays($today, false);
                $weekIndex = (int) floor(max(0, $daysSince) / 7);
                $week = $weeks[$weekIndex] ?? null;
                if (is_array($week) && isset($week['schedule']) && is_array($week['schedule'])) {
                    $schedule = $week['schedule'];
                }
            }

            $todaySessions = [];
            $day = $schedule[$todayName] ?? null;
            if (is_array($day)) {
                $todaySessions = $day['sessions'] ?? $day;
            }

            $planContext = [
                'title' => $activePlan->title,
                'goal' => $activePlan->goal,
                'starts_on' => $activePlan->starts_on?->toDateString(),
                'ends_on' => $activePlan->ends_on?->toDateString(),
                'today' => [
                    'day_name' => $todayName,
                    'sessions' => $todaySessions,
                ],
            ];
        }

        $recentSessions = StudySession::query()
            ->where('user_id', $user->id)
            ->where('status', 'completed')
            ->orderByDesc('started_at')
            ->limit(10)
            ->get(['started_at', 'duration_minutes', 'meta'])
            ->map(fn ($s) => [
                'started_at' => $s->started_at?->toIso8601String(),
                'duration_minutes' => (int) ($s->duration_minutes ?? 0),
                'subject' => (string) data_get($s->meta, 'subject_name', ''),
                'topic' => (string) data_get($s->meta, 'topic_name', ''),
            ])
            ->all();

        $stats = $this->progress->getStats($user, 14);

        return [
            'user' => [
                'name' => $user->name,
                'timezone' => $user->timezone,
                'daily_study_hours' => $user->daily_study_hours,
                'productivity_peak' => $user->productivity_peak,
                'learning_style' => $user->learning_style,
                'study_goal' => $user->study_goal,
            ],
            'progress' => [
                'xp' => data_get($stats, 'xp'),
                'streak' => data_get($stats, 'streak'),
                'sessions' => data_get($stats, 'sessions'),
                'insight' => data_get($stats, 'insight'),
            ],
            'active_plan' => $planContext,
            'recent_sessions' => $recentSessions,
            'generated_at' => Carbon::now()->toIso8601String(),
        ];
    }
}
