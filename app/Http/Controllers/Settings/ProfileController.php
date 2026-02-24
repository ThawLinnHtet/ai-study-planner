<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\ProfileDeleteRequest;
use App\Http\Requests\Settings\ProfilePictureRequest;
use App\Http\Requests\Settings\ProfileUpdateRequest;
use App\Services\UserProgressService;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    public function __construct(
        private UserProgressService $progressService
    ) {}

    /**
     * Show the user's profile settings page.
     */
    public function edit(Request $request): Response
    {
        $user = $request->user();
        $stats = $this->progressService->getStats($user);

        return Inertia::render('settings/profile', [
            'mustVerifyEmail' => $request->user() instanceof MustVerifyEmail,
            'status' => $request->session()->get('status'),
            'stats' => [
                'total_study_hours' => round($stats['sessions']['total_minutes'] / 60, 1),
                'current_streak' => $stats['streak']['current'],
                'longest_streak' => $stats['streak']['best'],
                'completed_sessions' => $stats['sessions']['total'],
                'weekly_goal' => round($stats['sessions']['week']['target_minutes'] / 60, 1),
                'weekly_progress' => round($stats['sessions']['week']['minutes'] / 60, 1),
                'achievements' => array_map(function ($achievement) {
                    return [
                        'id' => $achievement['id'],
                        'name' => $achievement['title'],
                        'description' => $achievement['description'],
                        'icon' => $this->getIconForAchievement($achievement['id']),
                        'earned' => $achievement['unlocked'],
                        'earned_at' => $achievement['unlocked'] ? now()->toDateString() : null,
                    ];
                }, $stats['achievements']),
            ],
        ]);
    }

    /**
     * Map achievement IDs to icon names
     */
    private function getIconForAchievement(string $achievementId): string
    {
        $iconMap = [
            'first_session' => 'book-open',
            'ten_sessions' => 'target',
            'five_hours' => 'clock',
            'streak_3' => 'flame',
            'streak_7' => 'flame',
            'week_10h' => 'award',
        ];

        return $iconMap[$achievementId] ?? 'award';
    }

    /**
     * Update the user's profile picture.
     */
    public function updatePicture(ProfilePictureRequest $request): RedirectResponse
    {
        $user = $request->user();
        
        // Delete old avatar if exists
        if ($user->avatar) {
            Storage::disk('public')->delete($user->avatar);
        }
        
        // Store new avatar
        $avatar = $request->file('avatar');
        $path = $avatar->store('avatars', 'public');
        
        $user->avatar = $path;
        $user->save();
        
        // Refresh the user data in session
        auth()->setUser($user);
        
        return back()->with('status', 'Profile picture updated successfully!');
    }

    /**
     * Delete the user's profile picture.
     */
    public function deletePicture(Request $request): RedirectResponse
    {
        $user = $request->user();
        
        if ($user->avatar) {
            Storage::disk('public')->delete($user->avatar);
            $user->avatar = null;
            $user->save();
            
            // Refresh the user data in session
            auth()->setUser($user);
        }
        
        return back()->with('status', 'Profile picture removed successfully!');
    }

    /**
     * Update the user's profile information.
     */
    public function update(ProfileUpdateRequest $request): RedirectResponse
    {
        $request->user()->fill($request->validated());

        if ($request->user()->isDirty('email')) {
            $request->user()->email_verified_at = null;
        }

        $request->user()->save();

        return to_route('profile.edit');
    }

    /**
     * Delete the user's profile.
     */
    public function destroy(ProfileDeleteRequest $request): RedirectResponse
    {
        $user = $request->user();

        Auth::logout();

        $user->delete();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/');
    }
}
