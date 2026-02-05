<?php

namespace App\Http\Controllers;

use App\Services\UserProgressService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ProgressController extends Controller
{
    public function __construct(protected UserProgressService $progress)
    {
    }

    public function index(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('progress', [
            'progress' => $this->progress->getStats($user, 30),
        ]);
    }
}
