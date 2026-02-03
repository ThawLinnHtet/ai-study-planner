<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Subject;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SubjectController extends Controller
{
    /**
     * Search subjects for autocomplete
     */
    public function search(Request $request): JsonResponse
    {
        $query = $request->get('q', '');
        $limit = min($request->get('limit', 20), 50);

        if (empty($query)) {
            return response()->json(['subjects' => []]);
        }

        // Simple text search
        $subjects = Subject::where('name', 'LIKE', "%{$query}%")
            ->orderBy('name')
            ->limit($limit)
            ->pluck('name')
            ->toArray();

        return response()->json(['subjects' => $subjects]);
    }

    /**
     * Add a new subject (optional - for custom subjects)
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:subjects,name',
        ]);

        $subject = Subject::create([
            'name' => trim($validated['name']),
        ]);

        return response()->json([
            'success' => true,
            'subject' => [
                'name' => $subject->name,
            ],
        ]);
    }

    /**
     * Get all subjects (for debugging/admin)
     */
    public function index(): JsonResponse
    {
        $subjects = Subject::orderBy('name')
            ->pluck('name')
            ->toArray();

        return response()->json(['subjects' => $subjects]);
    }
}
