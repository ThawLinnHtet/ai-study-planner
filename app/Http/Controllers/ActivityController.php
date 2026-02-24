<?php

namespace App\Http\Controllers;

use App\Services\ActivityTrackingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ActivityController extends Controller
{
    public function __construct(
        protected ActivityTrackingService $activityService
    ) {}

    public function track(Request $request): JsonResponse
    {
        $request->validate([
            'event_type' => 'required|string|in:app_opened,study_session_started,study_session_completed,task_completed,quiz_started,quiz_completed',
            'payload' => 'nullable|array',
        ]);

        $this->activityService->log(
            $request->user(),
            $request->input('event_type'),
            $request->input('payload', [])
        );

        return response()->json(['status' => 'ok']);
    }
}
