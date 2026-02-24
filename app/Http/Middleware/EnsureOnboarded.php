<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureOnboarded
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user) {
            return $next($request);
        }

        if ($user->onboarding_completed) {
            // Force user to dashboard loading screen if generation is in progress
            if ($user->is_generating_plan && ! $request->is('dashboard')) {
                return redirect()->route('dashboard');
            }

            if ($request->is('onboarding') || $request->is('onboarding/*')) {
                return redirect()->route('dashboard');
            }

            return $next($request);
        }

        if ($request->is('onboarding') || $request->is('onboarding/*')) {
            return $next($request);
        }

        return redirect('/onboarding');
    }
}
