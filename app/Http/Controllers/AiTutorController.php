<?php

namespace App\Http\Controllers;

use App\Services\NeuronChatService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AiTutorController extends Controller
{
    public function __construct(
        protected NeuronChatService $chat,
    ) {
    }

    public function newThread(Request $request): JsonResponse
    {
        return response()->json([
            'thread_id' => $this->chat->newThreadId(),
        ]);
    }

    public function threads(Request $request): JsonResponse
    {
        return response()->json([
            'threads' => $this->chat->listThreads($request->user()),
        ]);
    }

    public function messages(Request $request, string $threadId): JsonResponse
    {
        return response()->json([
            'thread_id' => $threadId,
            'messages' => $this->chat->getThreadMessages($request->user(), $threadId),
        ]);
    }

    public function send(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'message' => ['required', 'string', 'max:5000'],
            'thread_id' => ['nullable', 'string'],
        ]);

        $result = $this->chat->send(
            user: $request->user(),
            message: $validated['message'],
            threadId: $validated['thread_id'] ?? null,
        );

        return response()->json($result);
    }
}
