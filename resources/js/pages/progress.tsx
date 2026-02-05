import { Head } from '@inertiajs/react';
import { format, parseISO } from 'date-fns';
import { Award, Flame, Sparkles, Target, Timer } from 'lucide-react';
import Heading from '@/components/heading';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import AppLayout from '@/layouts/app-layout';
import { progress } from '@/routes';
import type { BreadcrumbItem } from '@/types';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip as RechartsTooltip,
    XAxis,
    YAxis,
} from 'recharts';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Progress',
        href: progress().url,
    },
];

type ProgressStats = {
    xp: {
        total: number;
        level: number;
        into_level: number;
        next_level_at: number;
        progress_percent: number;
    };
    sessions: {
        total: number;
        total_minutes: number;
        today: {
            sessions: number;
            minutes: number;
            xp: number;
        };
        week: {
            sessions: number;
            minutes: number;
            target_minutes: number;
            target_percent: number | null;
        };
    };
    streak: {
        current: number;
        best: number;
    };
    achievements: Array<{
        id: string;
        title: string;
        description: string;
        unlocked: boolean;
        progress_percent: number;
        value: number;
        goal: number;
    }>;
    series: Array<{ date: string; minutes: number; sessions: number; xp: number }>;
    insight: string;
};

interface Props {
    progress: ProgressStats;
}

function formatMinutes(minutes: number): string {
    const m = Math.max(0, minutes);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r === 0 ? `${h}h` : `${h}h ${r}m`;
}

export default function ProgressPage({ progress: stats }: Props) {
    const xpToNext = Math.max(0, stats.xp.next_level_at - stats.xp.total);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Progress" />

            <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
                <Heading
                    title="Progress"
                    description="Your streak, XP, achievements, and weekly momentum"
                />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background">
                        <CardHeader className="pb-2">
                            <CardDescription>Level</CardDescription>
                            <CardTitle className="flex items-end justify-between gap-3">
                                <span className="text-3xl font-black tracking-tight">{stats.xp.level}</span>
                                <Badge variant="secondary" className="gap-1">
                                    <Sparkles className="w-3 h-3" />
                                    {stats.xp.total.toLocaleString()} XP
                                </Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <Progress value={stats.xp.progress_percent} className="h-2" />
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>{stats.xp.into_level.toLocaleString()} XP into level</span>
                                <span>{xpToNext.toLocaleString()} XP to next</span>
                            </div>
                            <p className="text-xs text-muted-foreground italic leading-relaxed">{stats.insight}</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Streak</CardDescription>
                            <CardTitle className="flex items-center justify-between">
                                <span className="text-3xl font-black tracking-tight">{stats.streak.current}d</span>
                                <Flame className="w-6 h-6 text-amber-500" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 gap-3">
                            <div className="rounded-lg border bg-muted/30 p-3">
                                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Best</div>
                                <div className="mt-1 text-lg font-bold">{stats.streak.best}d</div>
                            </div>
                            <div className="rounded-lg border bg-muted/30 p-3">
                                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Today</div>
                                <div className="mt-1 text-lg font-bold">{formatMinutes(stats.sessions.today.minutes)}</div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Weekly Goal</CardDescription>
                            <CardTitle className="flex items-center justify-between">
                                <span className="text-3xl font-black tracking-tight">
                                    {stats.sessions.week.target_percent == null ? '—' : `${stats.sessions.week.target_percent}%`}
                                </span>
                                <Target className="w-6 h-6 text-primary" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <Progress value={stats.sessions.week.target_percent ?? 0} className="h-2" />
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>{formatMinutes(stats.sessions.week.minutes)} studied</span>
                                <span>
                                    {stats.sessions.week.target_minutes > 0
                                        ? `${formatMinutes(stats.sessions.week.target_minutes)} target`
                                        : 'Set a daily hours goal in settings'}
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="lg:col-span-2">
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2">
                                <Timer className="w-5 h-5 text-primary" />
                                Last 30 Days
                            </CardTitle>
                            <CardDescription>XP and minutes over time</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="h-[220px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={stats.series} margin={{ left: 8, right: 8, top: 10, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="xpFill" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                                                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                                        <XAxis
                                            dataKey="date"
                                            tickFormatter={(d) => format(parseISO(d), 'MMM d')}
                                            tick={{ fontSize: 11 }}
                                            axisLine={false}
                                            tickLine={false}
                                            interval="preserveStartEnd"
                                        />
                                        <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
                                        <RechartsTooltip
                                            contentStyle={{
                                                background: 'hsl(var(--popover))',
                                                border: '1px solid hsl(var(--border))',
                                                borderRadius: 12,
                                            }}
                                            labelFormatter={(d) => format(parseISO(String(d)), 'eeee, MMM d')}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="xp"
                                            stroke="hsl(var(--primary))"
                                            strokeWidth={2}
                                            fill="url(#xpFill)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="h-[180px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={stats.series} margin={{ left: 8, right: 8, top: 10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                                        <XAxis
                                            dataKey="date"
                                            tickFormatter={(d) => format(parseISO(d), 'MMM d')}
                                            tick={{ fontSize: 11 }}
                                            axisLine={false}
                                            tickLine={false}
                                            interval="preserveStartEnd"
                                        />
                                        <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
                                        <RechartsTooltip
                                            contentStyle={{
                                                background: 'hsl(var(--popover))',
                                                border: '1px solid hsl(var(--border))',
                                                borderRadius: 12,
                                            }}
                                            labelFormatter={(d) => format(parseISO(String(d)), 'eeee, MMM d')}
                                            formatter={(value) => [`${value} min`, 'Minutes']}
                                        />
                                        <Bar dataKey="minutes" radius={[8, 8, 0, 0]} fill="hsl(var(--primary))" opacity={0.85} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2">
                                <Award className="w-5 h-5 text-primary" />
                                Achievements
                            </CardTitle>
                            <CardDescription>Small wins create unstoppable momentum.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {stats.achievements.map((a) => (
                                <div key={a.id} className="rounded-xl border bg-muted/20 p-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="font-bold truncate">{a.title}</div>
                                            <div className="text-xs text-muted-foreground">{a.description}</div>
                                        </div>
                                        <Badge variant={a.unlocked ? 'default' : 'secondary'} className="shrink-0">
                                            {a.unlocked ? 'Unlocked' : `${a.progress_percent}%`}
                                        </Badge>
                                    </div>
                                    <div className="mt-3 space-y-2">
                                        <Progress value={a.progress_percent} className="h-2" />
                                        <div className="flex justify-between text-[11px] text-muted-foreground">
                                            <span>{a.value}/{a.goal}</span>
                                            <span>{a.unlocked ? 'Completed' : 'In progress'}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}
