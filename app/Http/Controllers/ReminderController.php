<?php

namespace App\Http\Controllers;

use App\Models\Reminder;
use App\Services\ReminderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReminderController extends Controller
{
    public function __construct(
        protected ReminderService $reminderService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $reminders = $this->reminderService->getRecentReminders($request->user());
        $unreadCount = $this->reminderService->getUnreadCount($request->user());

        return response()->json([
            'reminders' => $reminders,
            'unread_count' => $unreadCount,
        ]);
    }

    public function read(Request $request, Reminder $reminder)
    {
        if ($reminder->user_id !== $request->user()->id) {
            abort(403);
        }

        $reminder->markRead();

        if ($request->wantsJson()) {
            return response()->json(['status' => 'ok']);
        }

        return back();
    }

    public function dismiss(Request $request, Reminder $reminder)
    {
        if ($reminder->user_id !== $request->user()->id) {
            abort(403);
        }

        $reminder->dismiss();

        if ($request->wantsJson()) {
            return response()->json(['status' => 'ok']);
        }

        return back()->with('success', 'Reminder dismissed');
    }

    public function dismissAll(Request $request)
    {
        Reminder::where('user_id', $request->user()->id)
            ->whereIn('status', ['pending', 'sent', 'read'])
            ->update(['status' => 'dismissed']);

        if ($request->wantsJson()) {
            return response()->json(['status' => 'ok']);
        }

        return back()->with('success', 'All reminders dismissed');
    }

    public function toggleReminders(Request $request): JsonResponse
    {
        $request->validate([
            'enabled' => 'required|boolean',
        ]);

        $request->user()->update([
            'reminders_enabled' => $request->input('enabled'),
        ]);

        return response()->json(['status' => 'ok', 'enabled' => $request->input('enabled')]);
    }

    public function demo(Request $request): JsonResponse
    {
        if (!config('app.debug')) {
            abort(403, 'Demo reminders are only available in debug mode.');
        }

        $this->reminderService->seedDemoReminders($request->user());

        return response()->json(['status' => 'ok']);
    }
}
