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
        try {
            $thread = $this->chat->createThread($request->user(), 'New Chat');
            return response()->json([
                'thread_id' => $thread->id,
            ]);
        } catch (\RuntimeException $e) {
            return response()->json([
                'error' => $e->getMessage(),
            ], 422);
        }
    }

    public function threads(Request $request): JsonResponse
    {
        return response()->json([
            'threads' => $this->chat->listThreads($request->user()),
        ]);
    }

    public function messages(Request $request, int $threadId): JsonResponse
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
            'thread_id' => ['nullable', 'integer'],
        ]);

        $result = $this->chat->send(
            user: $request->user(),
            message: $validated['message'],
            threadId: $validated['thread_id'] ?? null,
        );

        return response()->json($result);
    }

    public function deleteThread(Request $request, int $threadId): JsonResponse
    {
        $this->chat->deleteThread($request->user(), $threadId);
        return response()->json(['success' => true]);
    }
}
