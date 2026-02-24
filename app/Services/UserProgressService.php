<?php

namespace App\Services;

use App\Models\StudySession;
use App\Models\User;
use App\Models\QuizResult;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class UserProgressService
{
    public function getStats(User $user, int $days = 30): array
    {
        $timezone = $user->timezone ?? config('app.timezone');
        $cacheKey = "user_stats_{$user->id}_{$days}_" . now($timezone)->toDateString();

        // Return from cache if available (cache is invalidated by clearUserCache() after sessions complete)
        $cached = cache()->get($cacheKey);
        if ($cached !== null) {
            return $cached;
        }

        $today = now($timezone);
        $start = $today->copy()->subDays(max(1, $days - 1))->startOfDay();
        $end = $today->copy()->endOfDay();

        $completedQuery = StudySession::query()
            ->where('user_id', $user->id)
            ->where('status', 'completed');

        $totalMinutes = (int) $completedQuery->clone()->sum(DB::raw('coalesce(duration_minutes, 0)'));
        $totalSessions = (int) $completedQuery->clone()->count();
        $totalXp = $this->calculateXpFromMinutesAndSessions($totalMinutes, $totalSessions);

        $level = $this->levelFromXp($totalXp);
        $xpForNextLevel = $this->xpForLevel($level + 1);
        $xpForCurrentLevel = $this->xpForLevel($level);
        $xpIntoLevel = max(0, $totalXp - $xpForCurrentLevel);
        $xpLevelSpan = max(1, $xpForNextLevel - $xpForCurrentLevel);
        $xpProgressPercent = (int) round(($xpIntoLevel / $xpLevelSpan) * 100);

        // Debug logging for verification
        Log::info('XP Calculation for User ' . $user->id, [
            'total_minutes' => $totalMinutes,
            'total_sessions' => $totalSessions,
            'total_xp' => $totalXp,
            'level' => $level,
            'xp_for_current_level' => $xpForCurrentLevel,
            'xp_for_next_level' => $xpForNextLevel,
            'xp_into_level' => $xpIntoLevel,
            'xp_to_next' => $xpForNextLevel - $totalXp,
            'progress_percent' => $xpProgressPercent,
            'cache_key' => $cacheKey,
        ]);

        $byDay = $completedQuery->clone()
            ->whereBetween('started_at', [$start, $end])
            ->selectRaw("date(started_at) as day, count(*) as sessions, sum(coalesce(duration_minutes, 0)) as minutes")
            ->groupBy('day')
            ->orderBy('day')
            ->get()
            ->keyBy('day');

        $series = [];
        for ($i = 0; $i < $days; $i++) {
            $d = $start->copy()->addDays($i);
            $key = $d->toDateString();
            $minutes = (int) ($byDay[$key]->minutes ?? 0);
            $sessions = (int) ($byDay[$key]->sessions ?? 0);
            $xp = $this->calculateXpFromMinutesAndSessions($minutes, $sessions);
            $series[] = [
                'date' => $key,
                'minutes' => $minutes,
                'sessions' => $sessions,
                'xp' => $xp,
            ];
        }

        $todayRow = $series[array_key_last($series)] ?? ['minutes' => 0, 'sessions' => 0, 'xp' => 0];

        $weekStart = $today->copy()->startOfWeek(Carbon::MONDAY);
        $weekMinutes = (int) $completedQuery->clone()
            ->where('started_at', '>=', now($timezone)->subDays(7))
            ->sum(DB::raw('coalesce(duration_minutes, 0)'));
        $weekSessions = (int) $completedQuery->clone()->where('started_at', '>=', now($timezone)->subDays(7))->count();

        $streak = $this->calculateStreaks($user);
        $achievements = $this->buildAchievements(
            totalSessions: $totalSessions,
            totalMinutes: $totalMinutes,
            streakCurrent: $streak['current'],
            streakBest: $streak['best'],
            weekMinutes: $weekMinutes,
        );

        // Calculate weekly target with adaptive defaults
        $dailyHours = (float) ($user->daily_study_hours ?? 0);
        $adaptiveTarget = false;
        
        // Dynamic default based on user's recent activity if no goal set
        if ($dailyHours <= 0) {
            $adaptiveTarget = true;
            
            // Check for recent study sessions first
            $recentSessions = StudySession::where('user_id', $user->id)
                ->where('status', 'completed')
                ->where('created_at', '>=', now($timezone)->subDays(14))
                ->get();
            
            if ($recentSessions->count() > 0) {
                // Calculate based on actual study patterns
                $avgMinutesPerSession = $recentSessions->avg('duration_minutes') ?? 60;
                $sessionsPerWeek = $recentSessions->count() / 2; // 14 days = 2 weeks
                $dailyHours = max(0.5, ($avgMinutesPerSession * $sessionsPerWeek) / (7 * 60));
                
                Log::info('Adaptive weekly goal based on study sessions', [
                    'user_id' => $user->id,
                    'recent_sessions' => $recentSessions->count(),
                    'avg_minutes' => $avgMinutesPerSession,
                    'sessions_per_week' => $sessionsPerWeek,
                    'calculated_daily_hours' => $dailyHours,
                ]);
            } else {
                // Check for quiz activity as fallback
                $recentQuizCount = QuizResult::where('user_id', $user->id)
                    ->where('taken_at', '>=', now($timezone)->subDays(14))
                    ->count();
                
                if ($recentQuizCount > 0) {
                    // User has quiz activity but no sessions - estimate based on quiz count
                    $dailyHours = max(1.0, $recentQuizCount / 7.0); // Assume 1 quiz per day average
                } else {
                    // No activity at all - use reasonable default
                    $dailyHours = 2.0; // 2 hours default daily goal
                }
                
                Log::info('Adaptive weekly goal based on quiz activity', [
                    'user_id' => $user->id,
                    'recent_quiz_count' => $recentQuizCount,
                    'calculated_daily_hours' => $dailyHours,
                ]);
            }
        }
        
        // Apply minimum and maximum limits
        $dailyHours = max(0.5, min(8.0, $dailyHours)); // Min 30min, Max 8 hours per day
        
        $weeklyTargetMinutes = (int) ($dailyHours * 7 * 60);
        $weekTargetPercent = $weeklyTargetMinutes > 0
            ? (int) min(100, round(($weekMinutes / $weeklyTargetMinutes) * 100))
            : 0;
        
        Log::info('Weekly goal calculation', [
            'user_id' => $user->id,
            'daily_hours' => $dailyHours,
            'adaptive_target' => $adaptiveTarget,
            'weekly_target_minutes' => $weeklyTargetMinutes,
            'week_minutes' => $weekMinutes,
            'week_target_percent' => $weekTargetPercent,
        ]);

        $stats = [
            'xp' => [
                'total' => $totalXp,
                'level' => $level,
                'into_level' => $xpIntoLevel,
                'next_level_at' => $xpForNextLevel,
                'progress_percent' => $xpProgressPercent,
            ],
            'sessions' => [
                'total' => $totalSessions,
                'total_minutes' => $totalMinutes,
                'today' => [
                    'sessions' => (int) ($todayRow['sessions'] ?? 0),
                    'minutes' => (int) ($todayRow['minutes'] ?? 0),
                    'xp' => (int) ($todayRow['xp'] ?? 0),
                ],
                'week' => [
                    'sessions' => $weekSessions,
                    'minutes' => $weekMinutes,
                    'xp' => $this->calculateXpFromMinutesAndSessions($weekMinutes, $weekSessions),
                    'target_minutes' => $weeklyTargetMinutes,
                    'target_percent' => $weekTargetPercent,
                ],
            ],
            'streak' => $streak,
            'achievements' => $achievements,
            'series' => $series,
            'insight' => $this->buildInsight(
                weekMinutes: $weekMinutes,
                weeklyTargetMinutes: $weeklyTargetMinutes,
                streakCurrent: $streak['current'],
            ),
        ];

        // Cache the results for 24 hours (until next day)
        cache()->put($cacheKey, $stats, now()->endOfDay());

        Log::info('Returning stats for User ' . $user->id, [
            'cache_key' => $cacheKey,
            'week_target_percent' => $stats['sessions']['week']['target_percent'],
            'week_minutes' => $stats['sessions']['week']['minutes'],
            'weekly_target_minutes' => $stats['sessions']['week']['target_minutes'],
            'total_sessions' => $stats['sessions']['total'],
            'streak_current' => $stats['streak']['current'],
        ]);

        return $stats;
    }

    /**
     * Clear the user's progress cache when new data is available
     */
    public function clearUserCache(User $user): void
    {
        $timezone = $user->timezone ?? config('app.timezone');
        $today = now($timezone)->toDateString();

        // Clear common cache keys for this user across all standard time windows
        $cacheKeys = [
            "user_stats_{$user->id}_30_{$today}",
            "user_stats_{$user->id}_14_{$today}",
            "user_stats_{$user->id}_7_{$today}",
            "user_stats_{$user->id}_1_{$today}",
        ];

        foreach ($cacheKeys as $key) {
            cache()->forget($key);
        }

        Log::info('Cleared cache for User ' . $user->id, [
            'cleared_keys' => $cacheKeys,
        ]);
    }

    protected function calculateXpFromMinutesAndSessions(int $minutes, int $sessions): int
    {
        $minutes = max(0, $minutes);
        $sessions = max(0, $sessions);

        // NEW FORMULA: (Minutes * 2) + (Sessions * 10)
        // Favors duration (Deep Work) while maintaining a completion bonus.
        return (int) round(($minutes * 2) + ($sessions * 10));
    }

    protected function levelFromXp(int $xp): int
    {
        $xp = max(0, $xp);

        $level = 1;
        while ($this->xpForLevel($level + 1) <= $xp) {
            $level++;
        }

        return $level;
    }

    protected function xpForLevel(int $level): int
    {
        $level = max(1, $level);

        return (int) (100 * ($level - 1) * ($level - 1));
    }

    protected function calculateStreaks(User $user): array
    {
        $dbStreak = (int) ($user->study_streak ?? 0);
        
        $days = StudySession::query()
            ->where('user_id', $user->id)
            ->where('status', 'completed')
            ->selectRaw('date(started_at) as day')
            ->distinct()
            ->orderBy('day')
            ->pluck('day')
            ->map(fn ($d) => Carbon::parse($d)->toDateString())
            ->values()
            ->all();

        if (empty($days)) {
            return ['current' => $dbStreak, 'best' => $dbStreak];
        }

        // Calculate current streak - count consecutive days ending with most recent study day
        $current = 0;
        $mostRecentDayStr = end($days);
        $mostRecentDay = Carbon::parse($mostRecentDayStr);
        
        // Loop backwards to count consecutive days
        for ($i = 0; $i < 365; $i++) {
            $checkDate = $mostRecentDay->copy()->subDays($i)->toDateString();
            if (in_array($checkDate, $days)) {
                $current++;
            } else {
                break;
            }
        }

        // More forgiving streak calculation: Check if the streak is still active
        // A streak is active if the most recent study was today or yesterday
        $timezone = $user->timezone ?? config('app.timezone');
        $today = Carbon::today($timezone)->toDateString();
        $yesterday = Carbon::yesterday($timezone)->toDateString();
        
        if ($mostRecentDayStr !== $today && $mostRecentDayStr !== $yesterday) {
            // Check for grace period (e.g. 1 day gap allowed for long streaks)
            $twoDaysAgo = Carbon::today($timezone)->subDays(2)->toDateString();
            if ($mostRecentDayStr === $twoDaysAgo && $current >= 3) {
                // Keep the streak (grace period applied)
                Log::info('Streak grace applied in UserProgressService', ['user_id' => $user->id, 'streak' => $current]);
            } else {
                // Gap too long - session-based streak resets
                $current = 0;
            }
        }

        // Always respect the DB streak as a floor - it's the "official" record
        $finalCurrent = max($current, $dbStreak);
        
        return ['current' => $finalCurrent, 'best' => $finalCurrent];
    }

    protected function buildAchievements(
        int $totalSessions,
        int $totalMinutes,
        int $streakCurrent,
        int $streakBest,
        int $weekMinutes,
    ): array {
        $defs = [
            [
                'id' => 'first_session',
                'title' => 'First Step',
                'description' => 'Complete your first study session.',
                'metric' => 'sessions',
                'goal' => 1,
                'value' => $totalSessions,
                'xp_reward' => 50,
            ],
            [
                'id' => 'ten_sessions',
                'title' => 'Consistency Builder',
                'description' => 'Complete 10 study sessions.',
                'metric' => 'sessions',
                'goal' => 10,
                'value' => $totalSessions,
                'xp_reward' => 200,
            ],
            [
                'id' => 'five_hours',
                'title' => 'Deep Dive',
                'description' => 'Study for 5 total hours.',
                'metric' => 'minutes',
                'goal' => 300,
                'value' => $totalMinutes,
                'xp_reward' => 150,
            ],
            [
                'id' => 'streak_3',
                'title' => '3-Day Streak',
                'description' => 'Study 3 days in a row.',
                'metric' => 'streak',
                'goal' => 3,
                'value' => $streakBest,
                'xp_reward' => 100,
            ],
            [
                'id' => 'streak_7',
                'title' => '7-Day Streak',
                'description' => 'Study 7 days in a row.',
                'metric' => 'streak',
                'goal' => 7,
                'value' => $streakBest,
                'xp_reward' => 300,
            ],
            [
                'id' => 'week_10h',
                'title' => 'Weekly Warrior',
                'description' => 'Study 10 hours this week.',
                'metric' => 'week_minutes',
                'goal' => 600,
                'value' => $weekMinutes,
                'xp_reward' => 250,
            ],
        ];

        return array_map(function (array $d) use ($streakCurrent) {
            $value = (int) ($d['value'] ?? 0);
            $goal = (int) ($d['goal'] ?? 0);
            $unlocked = $goal > 0 ? $value >= $goal : false;
            $progress = $goal > 0 ? (int) min(100, round(($value / $goal) * 100)) : 0;

            if (($d['metric'] ?? '') === 'streak') {
                $value = max($value, $streakCurrent);
                $unlocked = $value >= $goal;
                $progress = $goal > 0 ? (int) min(100, round(($value / $goal) * 100)) : 0;
            }

            return [
                'id' => (string) $d['id'],
                'title' => (string) $d['title'],
                'description' => (string) $d['description'],
                'unlocked' => $unlocked,
                'progress_percent' => $progress,
                'value' => $value,
                'goal' => $goal,
                'xp_reward' => $d['xp_reward'] ?? 0,
            ];
        }, $defs);
    }

    protected function buildInsight(int $weekMinutes, int $weeklyTargetMinutes, int $streakCurrent): string
    {
        if ($weekMinutes <= 0) {
            if ($streakCurrent === 0) {
                return '🌱 Start your journey today! Even 15 minutes makes a difference.';
            } else {
                return '🔥 Great streak! Keep it going with a quick session today.';
            }
        }

        if ($weeklyTargetMinutes > 0) {
            $pct = (int) round(($weekMinutes / $weeklyTargetMinutes) * 100);
            $remaining = max(0, $weeklyTargetMinutes - $weekMinutes);
            $dailyTarget = round($weeklyTargetMinutes / 60 / 7, 1);
            
            if ($pct >= 100) {
                return '🎉 Weekly goal achieved! You\'re crushing it - consider setting a higher goal next week.';
            } elseif ($pct >= 90) {
                return '⚡ Almost there! Just ' . round($remaining/60, 1) . ' more hours to hit your weekly goal.';
            } elseif ($pct >= 75) {
                return '📈 Strong progress! You\'re on track - add ' . round($remaining/60, 1) . ' more hours this week.';
            } elseif ($pct >= 50) {
                return '💪 Good momentum! Focus on ' . $dailyTarget . ' hours daily to reach your goal.';
            } elseif ($pct >= 25) {
                return '🚀 Building consistency! Try studying ' . $dailyTarget . ' hours per day.';
            } else {
                return '🌟 Just getting started! Aim for ' . $dailyTarget . ' hours daily to build your habit.';
            }
        }

        if ($streakCurrent >= 7) {
            return '🔥 Amazing ' . $streakCurrent . '-day streak! You\'re building incredible habits.';
        } elseif ($streakCurrent >= 3) {
            return '👏 Great ' . $streakCurrent . '-day streak! Keep the momentum going.';
        } elseif ($streakCurrent >= 1) {
            return '🎯 Nice ' . $streakCurrent . '-day streak! Study today to extend it.';
        }

        return '💎 Every study session brings you closer to your goals. Start today!';
    }
}
