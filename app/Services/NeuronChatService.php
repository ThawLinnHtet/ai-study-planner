<?php

namespace App\Services;

use App\Models\AiMessage;
use App\Models\ChatThread;
use App\Models\ChatMessage;
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

    /**
     * Create a new chat thread for a user.
     */
    public function createThread(User $user, ?string $title = null): ChatThread
    {
        $providerThreadId = (string) Str::uuid();

        return ChatThread::create([
            'user_id' => $user->id,
            'provider_thread_id' => $providerThreadId,
            'title' => $title ?? 'New Chat',
            'metadata' => [],
        ]);
    }

    /**
     * Validate thread ownership - ensures user owns the thread.
     */
    private function validateThreadOwnership(User $user, int $threadId): ChatThread
    {
        $thread = ChatThread::where('id', $threadId)
            ->where('user_id', $user->id)
            ->first();

        if (! $thread) {
            throw new \RuntimeException('Thread not found or access denied.', 403);
        }

        return $thread;
    }

    /**
     * List all threads for a user.
     */
    public function listThreads(User $user, int $limit = 20): array
    {
        $threads = ChatThread::where('user_id', $user->id)
            ->orderByDesc('last_message_at')
            ->limit($limit)
            ->get();

        return $threads->map(fn (ChatThread $thread) => [
            'thread_id' => $thread->id,
            'provider_thread_id' => $thread->provider_thread_id,
            'title' => $thread->title,
            'updated_at' => $thread->last_message_at?->toIso8601String() ?? $thread->updated_at->toIso8601String(),
            'preview' => $this->getThreadPreview($thread),
        ])->all();
    }

    /**
     * Get preview text from the last message in a thread.
     */
    private function getThreadPreview(ChatThread $thread): string
    {
        $lastMessage = $thread->messages()->orderByDesc('created_at')->first();
        
        if (! $lastMessage) {
            return 'No messages yet';
        }

        return Str::limit((string) $lastMessage->content, 80);
    }

    /**
     * Get messages for a specific thread.
     */
    public function getThreadMessages(User $user, int $threadId, int $limit = 50): array
    {
        $thread = $this->validateThreadOwnership($user, $threadId);

        return $thread->messages()
            ->orderBy('created_at')
            ->limit($limit)
            ->get(['id', 'role', 'content', 'created_at'])
            ->map(fn (ChatMessage $message) => [
                'id' => $message->id,
                'role' => $message->role,
                'content' => $message->content,
                'created_at' => $message->created_at?->toIso8601String(),
            ])
            ->all();
    }

    /**
     * Delete a thread (soft delete via messages).
     */
    public function deleteThread(User $user, int $threadId): void
    {
        $thread = $this->validateThreadOwnership($user, $threadId);
        
        // Soft delete all messages in the thread
        ChatMessage::where('chat_thread_id', $thread->id)->delete();
        
        // Soft delete the thread itself
        $thread->delete();
    }

    /**
     * Send a message to a thread with streaming response.
     */
    public function sendStream(User $user, string $message, ?int $threadId = null): \Generator
    {
        // Validate or create thread
        if ($threadId) {
            $thread = $this->validateThreadOwnership($user, $threadId);
        } else {
            $thread = $this->createThread($user, 'New Chat');
            $threadId = $thread->id;
        }

        // Store user message
        ChatMessage::create([
            'chat_thread_id' => $thread->id,
            'user_id' => $user->id,
            'role' => 'user',
            'content' => $message,
            'metadata' => [],
        ]);

        // Update thread last message timestamp
        $thread->update(['last_message_at' => Carbon::now()]);

        // Get message history for context
        $history = $thread->messages()
            ->orderByDesc('created_at')
            ->limit(20)
            ->get(['role', 'content'])
            ->reverse()
            ->values();

        // Build AI context and messages
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

        yield json_encode(['type' => 'thread_id', 'thread_id' => $threadId])."\n\n";

        // Call AI API
        $fullContent = '';
        $key = (string) (config('services.openrouter.key') ?? '');
        if ($key === '') {
            throw new \RuntimeException('OpenRouter API key is not configured.');
        }

        $baseUrl = (string) (config('services.openrouter.base_url') ?? 'https://openrouter.ai/api/v1');

        $payload = [
            'model' => config('services.openrouter.model', 'google/gemini-2.0-flash-001'),
            'messages' => $messages,
            'temperature' => 0.4,
            'max_tokens' => 800,
            'stream' => true,
        ];

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

            // Store assistant response
            ChatMessage::create([
                'chat_thread_id' => $thread->id,
                'user_id' => $user->id,
                'role' => 'assistant',
                'content' => $fullContent,
                'metadata' => ['context' => $context],
            ]);

            // Update thread last message timestamp
            $thread->update(['last_message_at' => Carbon::now()]);

            yield json_encode(['type' => 'done'])."\n\n";
        } catch (\Exception $e) {
            yield json_encode(['type' => 'error', 'message' => $e->getMessage()])."\n\n";
        }
    }

    /**
     * Send a non-streaming message.
     */
    public function send(User $user, string $message, ?int $threadId = null): array
    {
        // Validate or create thread
        if ($threadId) {
            $thread = $this->validateThreadOwnership($user, $threadId);
        } else {
            $thread = $this->createThread($user, 'New Chat');
            $threadId = $thread->id;
        }

        // Store user message
        ChatMessage::create([
            'chat_thread_id' => $thread->id,
            'user_id' => $user->id,
            'role' => 'user',
            'content' => $message,
            'metadata' => [],
        ]);

        // Update thread last message timestamp
        $thread->update(['last_message_at' => Carbon::now()]);

        // Get message history
        $history = $thread->messages()
            ->orderByDesc('created_at')
            ->limit(20)
            ->get(['role', 'content'])
            ->reverse()
            ->values();

        // Build context and messages
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

        // Call AI API
        $key = (string) (config('services.openrouter.key') ?? '');
        if ($key === '') {
            throw new \RuntimeException('OpenRouter API key is not configured.');
        }

        $baseUrl = (string) (config('services.openrouter.base_url') ?? 'https://openrouter.ai/api/v1');

        $payload = [
            'model' => config('services.openrouter.model', 'google/gemini-2.0-flash-001'),
            'messages' => $messages,
            'temperature' => 0.4,
            'max_tokens' => 800,
            'stream' => false,
        ];

        try {
            $response = Http::withHeaders([
                'Authorization' => 'Bearer '.$key,
                'HTTP-Referer' => (string) config('app.url'),
                'X-Title' => (string) config('app.name'),
            ])->post(rtrim($baseUrl, '/').'/chat/completions', $payload);

            if ($response->failed()) {
                throw new \RuntimeException('AI service error: '.$response->body());
            }

            $data = $response->json();
            $content = $data['choices'][0]['message']['content'] ?? 'Sorry, I could not generate a response.';

            // Store assistant response
            ChatMessage::create([
                'chat_thread_id' => $thread->id,
                'user_id' => $user->id,
                'role' => 'assistant',
                'content' => $content,
                'metadata' => ['context' => $context],
            ]);

            // Update thread last message timestamp
            $thread->update(['last_message_at' => Carbon::now()]);

            return [
                'thread_id' => $threadId,
                'message' => $content,
            ];
        } catch (\Exception $e) {
            return [
                'thread_id' => $threadId,
                'message' => 'Error: '.$e->getMessage(),
            ];
        }
    }

    protected function systemPrompt(array $context): string
    {
        $ctx = json_encode($context, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $subjects = json_encode($context['user']['subjects'] ?? []);
        $todayTopics = $this->getTodayTopics($context);
        $recentTopics = $this->getRecentTopics($context);

        return "You are Neuron, a study-focused AI tutor inside a study planner app.\n\n".
            "3-TIER PRIORITY SYSTEM (INTERNAL USE ONLY):\n\n".
            "CRITICAL: NEVER mention 'Tier', 'Priority 1', 'Priority 2', 'Priority 3' or any system references to users.\n".
            "The priority system is for your internal decision-making only.\n".
            "Users should see natural, helpful responses without any technical language.\n".
            "Do not say 'According to Priority 1' or similar - just help them directly.\n\n".
            "TODAY'S TOPICS (Priority 1 - Explain in detail):\n".
            "- Today's scheduled topics: {$todayTopics}\n".
            "- Always prioritize explaining and helping with today's topics first\n".
            "- Give detailed explanations, examples, and practice suggestions\n\n".
            "RECENT TOPICS (Priority 2 - Support if needed):\n".
            "- Recent topics: {$recentTopics}\n".
            "- If user asks about a recent topic, help them - it builds on today's learning\n".
            "- Connect recent topics to today's work when possible\n".
            "- Example: 'Good question about derivatives from yesterday! Understanding that will help with today's integration topic.'\n\n".
            "GENERAL SUBJECT HELP (Priority 3 - Strategy & motivation):\n".
            "- User's enrolled subjects: {$subjects}\n".
            "- Answer general study strategy questions for their subjects\n".
            "- Provide motivation, study tips, and exam preparation advice\n".
            "- Help with overall subject understanding\n\n".
            "HARD BOUNDARY - REJECT EVERYTHING ELSE:\n".
            "- If topic is NOT in their subjects, respond with this format:\n".
"  'That topic isn't part of your study plan.\\n\\n'.\n".
"  'Your subjects are:\\n'.\n".
"  '• Math\\n'.\n".
"  '• Physics\\n'.\n".
"  '• Chemistry\\n\\n'.\n".
"  'Would you like help with today's topic instead?'\n\n".
"IMPORTANT: Replace 'Math', 'Physics', 'Chemistry' above with the actual subjects from the user's subjects array in the context.\n".
            "- NEVER use general knowledge outside their enrolled subjects\n".
            "- NEVER answer random questions unrelated to their studies\n".
            "- Stay in your role as their personal study tutor\n\n".
            "Response Style:\n".
            "- Be concise but high-signal\n".
            "- Give actionable numbered steps when recommending actions (use 1., 2., 3. format)\n".
            "- Use plain text without markdown formatting (no **bold**, *italic*, etc.)\n".
            "- Reference their actual progress, streak, and schedule\n".
            "- Be encouraging but honest\n\n".
            "APP_CONTEXT_JSON:\n".
            $ctx;
    }

    protected function getTodayTopics(array $context): string
    {
        $todaySessions = data_get($context, 'active_plan.today.sessions', []);
        $topics = [];

        foreach ($todaySessions as $session) {
            $subject = data_get($session, 'subject', '');
            $topic = data_get($session, 'topic', '');
            if ($subject && $topic) {
                $topics[] = "{$subject}: {$topic}";
            }
        }

        return json_encode(array_filter($topics)) ?: '[]';
    }

    protected function getRecentTopics(array $context): string
    {
        $recentDays = data_get($context, 'active_plan.recent_days', []);
        $topics = [];

        foreach ($recentDays as $dayName => $sessions) {
            foreach ($sessions as $session) {
                $subject = data_get($session, 'subject', '');
                $topic = data_get($session, 'topic', '');
                if ($subject && $topic) {
                    $topics[] = "{$dayName} - {$subject}: {$topic}";
                }
            }
        }

        return json_encode(array_filter($topics)) ?: '[]';
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

            // Get recent 3 days topics from schedule
            $recentDaysTopics = [];
            for ($i = 1; $i <= 3; $i++) {
                $pastDay = $today->copy()->subDays($i);
                $pastDayName = $pastDay->format('l');
                $pastDaySessions = [];
                $pastDayData = $schedule[$pastDayName] ?? null;
                if (is_array($pastDayData)) {
                    $pastDaySessions = $pastDayData['sessions'] ?? $pastDayData;
                }
                if (!empty($pastDaySessions)) {
                    $recentDaysTopics[$pastDayName] = array_map(fn ($s) => [
                        'subject' => $s['subject'] ?? '',
                        'topic' => $s['topic'] ?? '',
                    ], $pastDaySessions);
                }
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
                'recent_days' => $recentDaysTopics,
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
                'subjects' => $user->subjects ?? [],
                'daily_study_hours' => $user->daily_study_hours,
                'productivity_peak' => $user->productivity_peak,
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
            'generated_at' => now()->toIso8601String(),
        ];
    }
}
