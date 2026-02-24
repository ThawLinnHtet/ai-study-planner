<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Socialite\Facades\Socialite;

class GoogleAuthController extends Controller
{
    public function redirect(): RedirectResponse
    {
        return Socialite::driver('google')->redirect();
    }

    public function callback(): RedirectResponse
    {
        try {
            $googleUser = Socialite::driver('google')->stateless()->user();
        } catch (\Throwable $exception) {
            report($exception);

            return redirect()->route('login')->with('status', 'We could not sign you in with Google. Please try again.');
        }

        $user = DB::transaction(function () use ($googleUser) {
            $user = User::where('google_id', $googleUser->getId())->first()
                ?? User::where('email', $googleUser->getEmail())->first();

            if (! $user) {
                $user = new User([
                    'name' => $googleUser->getName() ?: $googleUser->getNickname() ?: 'New Learner',
                    'email' => $googleUser->getEmail(),
                ]);
                $user->password = Hash::make(Str::random(60));
                $user->email_verified_at = now();
            }

            $user->fill([
                'name' => $googleUser->getName() ?: $user->name,
                'email' => $googleUser->getEmail() ?: $user->email,
                'auth_provider' => 'google',
                'google_id' => $googleUser->getId(),
                'google_email' => $googleUser->getEmail(),
                'google_avatar' => $googleUser->getAvatar(),
                'google_connected_at' => now(),
            ]);

            if (! $user->email_verified_at) {
                $user->email_verified_at = now();
            }

            $user->save();

            return $user;
        });

        Auth::login($user, true);

        return redirect()->intended(route('dashboard'));
    }
}
