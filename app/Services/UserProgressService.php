<?php

namespace App\Services;

use App\Models\StudySession;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class UserProgressService
{
    public function getStats(User $user, int $days = 14): array
    {
        $today = Carbon::today();
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
            ->where('started_at', '>=', $weekStart)
            ->sum(DB::raw('coalesce(duration_minutes, 0)'));
        $weekSessions = (int) $completedQuery->clone()->where('started_at', '>=', $weekStart)->count();

        $streak = $this->calculateStreaks($user);
        $achievements = $this->buildAchievements(
            totalSessions: $totalSessions,
            totalMinutes: $totalMinutes,
            streakCurrent: $streak['current'],
            streakBest: $streak['best'],
            weekMinutes: $weekMinutes,
        );

        $weeklyTargetMinutes = max(0, ((int) ($user->daily_study_hours ?? 0)) * 7 * 60);
        $weekTargetPercent = $weeklyTargetMinutes > 0
            ? (int) min(100, round(($weekMinutes / $weeklyTargetMinutes) * 100))
            : null;

        return [
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
    }

    protected function calculateXpFromMinutesAndSessions(int $minutes, int $sessions): int
    {
        $minutes = max(0, $minutes);
        $sessions = max(0, $sessions);

        return (int) round(($minutes * 1.2) + ($sessions * 35));
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
            return ['current' => 0, 'best' => 0];
        }

        $best = 1;
        $run = 1;
        for ($i = 1; $i < count($days); $i++) {
            $prev = Carbon::parse($days[$i - 1]);
            $curr = Carbon::parse($days[$i]);
            if ($prev->diffInDays($curr) === 1) {
                $run++;
                $best = max($best, $run);
            } else {
                $run = 1;
            }
        }

        $set = array_flip($days);
        $today = Carbon::today();
        $current = 0;
        for ($i = 0; $i < 365; $i++) {
            $key = $today->copy()->subDays($i)->toDateString();
            if (! isset($set[$key])) {
                break;
            }
            $current++;
        }

        return ['current' => $current, 'best' => $best];
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
            ],
            [
                'id' => 'ten_sessions',
                'title' => 'Consistency Builder',
                'description' => 'Complete 10 study sessions.',
                'metric' => 'sessions',
                'goal' => 10,
                'value' => $totalSessions,
            ],
            [
                'id' => 'five_hours',
                'title' => 'Deep Dive',
                'description' => 'Study for 5 total hours.',
                'metric' => 'minutes',
                'goal' => 300,
                'value' => $totalMinutes,
            ],
            [
                'id' => 'streak_3',
                'title' => '3-Day Streak',
                'description' => 'Study 3 days in a row.',
                'metric' => 'streak',
                'goal' => 3,
                'value' => $streakBest,
            ],
            [
                'id' => 'streak_7',
                'title' => '7-Day Streak',
                'description' => 'Study 7 days in a row.',
                'metric' => 'streak',
                'goal' => 7,
                'value' => $streakBest,
            ],
            [
                'id' => 'week_10h',
                'title' => 'Weekly Warrior',
                'description' => 'Study 10 hours this week.',
                'metric' => 'week_minutes',
                'goal' => 600,
                'value' => $weekMinutes,
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
            ];
        }, $defs);
    }

    protected function buildInsight(int $weekMinutes, int $weeklyTargetMinutes, int $streakCurrent): string
    {
        if ($weekMinutes <= 0) {
            return 'Start with one small session today. Momentum beats motivation.';
        }

        if ($weeklyTargetMinutes > 0) {
            $pct = (int) round(($weekMinutes / $weeklyTargetMinutes) * 100);
            if ($pct >= 90) {
                return 'You\'re on track for your weekly goal. Keep the rhythm and protect your focus blocks.';
            }
            if ($pct >= 60) {
                return 'Solid progress this week. Add one deep-focus session to lock in your gains.';
            }

            return 'You\'re building consistency. Try a 25-minute Focus Sprint to increase weekly momentum.';
        }

        if ($streakCurrent >= 3) {
            return 'Your streak is strong. Consider increasing difficulty slightly on one session for growth.';
        }

        return 'Nice start. Consistency is your superpower—repeat a small win tomorrow.';
    }
}
