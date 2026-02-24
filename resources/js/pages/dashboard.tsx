import { Head, Link, router } from '@inertiajs/react';
import { format, parseISO, startOfDay, addDays } from 'date-fns';
import {
    Zap,
    Calendar,
    CheckCircle2,
    Clock,
    ArrowRight,
    Target,
    Brain,
    AlertCircle,
    Flame,
    Sparkles,
    Trophy,
    RefreshCw
} from 'lucide-react';
import { StreakIcon, getStreakMessage, getStreakColor } from '@/components/streak-icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import AppLayout from '@/layouts/app-layout';
import { cn, formatDuration } from '@/lib/utils';
import { dashboard } from '@/routes';
import type { BreadcrumbItem } from '@/types';
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { getSubjectColor } from '@/lib/subject-colors';

const STREAK_MILESTONES = [1, 3, 7, 14, 30, 60, 100];
const CONFETTI_COLORS = ['bg-orange-400', 'bg-amber-300', 'bg-pink-400', 'bg-sky-400', 'bg-emerald-400'];
const STREAK_CELEBRATION_STYLES = `
@keyframes confetti-fall {
    0% { transform: translateY(-10vh) rotateZ(0deg); opacity: 0; }
    10% { opacity: 1; }
    100% { transform: translateY(80vh) rotateZ(360deg); opacity: 0; }
}

@keyframes streak-pop {
    0% { transform: scale(0.9); }
    40% { transform: scale(1.05); }
    100% { transform: scale(1); }
}

@keyframes streak-glow {
    0%, 100% { box-shadow: 0 0 0 rgba(249, 115, 22, 0.25); }
    50% { box-shadow: 0 0 35px rgba(249, 115, 22, 0.55); }
}

.confetti-piece {
    position: absolute;
    width: 10px;
    height: 28px;
    border-radius: 9999px;
    opacity: 0.9;
    animation-name: confetti-fall;
    animation-timing-function: linear;
    animation-iteration-count: infinite;
}
`;

interface StreakCelebrationState {
    streak: number;
    milestone: number;
}

interface ConfettiPiece {
    id: number;
    left: number;
    delay: number;
    duration: number;
    colorClass: string;
}

interface Session {
    subject: string;
    topic: string;
    duration_minutes: number;
    focus_level: 'low' | 'medium' | 'high';
}

interface Plan {
    id: number;
    title: string;
    goal: string;
    starts_on: string;
    ends_on: string;
    generated_plan: {
        schedule: Record<string, { sessions: Session[] }>;
        strategy_summary: string;
        is_cycle_complete?: boolean;
        days_remaining?: number;
        current_week?: number;
        total_weeks?: number;
    };
}

interface CompletedSession {
    id: number;
    subject: string;
    topic?: string;
    learning_path_id?: number;
}

type ProgressStats = {
    xp: {
        total: number;
        level: number;
        progress_percent: number;
    };
    streak: {
        current: number;
        best: number;
    };
    sessions: {
        week: {
            minutes: number;
            target_minutes: number;
            target_percent: number | null;
        };
        total: number;
        total_minutes: number;
    };
    insight: string;
};

interface DashboardSession {
    subject: string;
    topic: string;
    duration_minutes: number;
    focus_level?: string;
    is_learning_path?: boolean;
    id?: number;
}

interface Props {
    plan?: Plan;
    activeLearningPaths?: {
        id: number;
        subject: string;
        topic: string;
        duration_minutes: number;
        is_learning_path: boolean;
    }[];
    completedToday: CompletedSession[];
    progress: ProgressStats;
    isGeneratingPlan?: boolean;
    generatingStatus?: string;
    isBehindSchedule?: boolean;
    futureLearningPaths?: {
        id: number;
        subject_name: string;
        start_date: string;
    }[];
}

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: dashboard().url,
    },
];

const getGreeting = (name?: string) => {
    const hour = new Date().getHours();
    const playerName = name ? `, ${name.split(' ')[0]}` : '';

    if (hour < 12) return `Good morning${playerName} 🌤️`;
    if (hour < 17) return `Good afternoon${playerName} ☀️`;
    if (hour < 21) return `Good evening${playerName} 🌙`;
    return `Charging up for tomorrow${playerName}? 🔋`;
};

export default function Dashboard({ plan, activeLearningPaths = [], completedToday, progress, auth, isGeneratingPlan, generatingStatus, futureLearningPaths = [], isBehindSchedule }: Props & { auth: any }) {
    const [streakCelebration, setStreakCelebration] = useState<StreakCelebrationState | null>(null);
    const [confettiPieces, setConfettiPieces] = useState<ConfettiPiece[]>([]);
    const celebrationStyleRef = useRef<HTMLStyleElement | null>(null);
    const userId = auth?.user?.id;

    // Polling for plan generation
    useEffect(() => {
        let interval: any;
        if (isGeneratingPlan) {
            interval = setInterval(() => {
                router.reload({ only: ['plan', 'activeLearningPaths', 'isGeneratingPlan', 'generatingStatus', 'progress'] });
            }, 2000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isGeneratingPlan]);

    const generateConfettiPieces = useCallback((): ConfettiPiece[] => (
        Array.from({ length: 28 }, (_, index) => ({
            id: index,
            left: Math.random() * 100,
            delay: Math.random() * 0.8,
            duration: 3 + Math.random() * 2,
            colorClass: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
        }))
    ), []);

    const getStreakHeadline = useCallback((milestone: number) => {
        if (milestone === 1) return '🔥 Your first streak!';
        if (milestone < 7) return `${milestone}-day streak! You're on fire!`;
        if (milestone < 30) return `${milestone} days! Amazing consistency!`;
        return `${milestone} days! You're a legend!`;
    }, []);

    const getStreakSubtext = useCallback((milestone: number, streak: number) => {
        if (milestone === 1) return 'Great job showing up today! Come back tomorrow to keep it going.';
        if (milestone < 7) return `You've studied for ${streak} days in a row. Way to build the habit!`;
        if (milestone < 30) return `${streak} days of dedication! Your hard work is paying off!`;
        return `Incredible! ${streak} days without missing a beat. You're unstoppable!`;
    }, []);

    useEffect(() => {
        if (typeof document === 'undefined' || celebrationStyleRef.current) return;
        const styleElement = document.createElement('style');
        styleElement.textContent = STREAK_CELEBRATION_STYLES;
        document.head.appendChild(styleElement);
        celebrationStyleRef.current = styleElement;
        return () => {
            if (celebrationStyleRef.current) {
                document.head.removeChild(celebrationStyleRef.current);
                celebrationStyleRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (!userId || typeof window === 'undefined') return;

        // Add a slight delay to allow the page to settle and prevent the "too fast" blink
        const timer = setTimeout(() => {
            const currentStreak = progress.streak.current ?? 0;
            const storageKey = `streak_milestone_user_${userId}`;
            const storedValueRaw = localStorage.getItem(storageKey);
            const lastCelebrated = storedValueRaw ? Number(storedValueRaw) : 0;

            if (currentStreak <= 0) {
                localStorage.setItem(storageKey, '0');
                setStreakCelebration(null);
                return;
            }

            if (lastCelebrated > currentStreak) {
                localStorage.setItem(storageKey, String(Math.max(0, currentStreak - 1)));
                return;
            }

            const eligibleMilestone = STREAK_MILESTONES.filter((value) => currentStreak >= value).pop();
            if (eligibleMilestone && eligibleMilestone > lastCelebrated) {
                setStreakCelebration({ streak: currentStreak, milestone: eligibleMilestone });
                setConfettiPieces(generateConfettiPieces());
                localStorage.setItem(storageKey, String(eligibleMilestone));
            }
        }, 800); // 800ms delay for a better premium feel

        return () => clearTimeout(timer);
    }, [generateConfettiPieces, progress.streak.current, userId]);

    const dismissCelebration = useCallback(() => {
        setStreakCelebration(null);
    }, []);

    const handleRebalance = () => {
        router.post('/study-plan/rebalance', {}, {
            onStart: () => {
                // The backend updates is_generating_plan which triggers our polling
            },
            onSuccess: () => {
                // Success message is handled by flash messages or backend redirect
            }
        });
    };

    if (isGeneratingPlan) {
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title="Generating Plan..." />
                <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center space-y-8">
                    <div className="relative">
                        <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl animate-pulse"></div>
                        <div className="relative bg-white dark:bg-slate-900 p-8 rounded-full shadow-2xl border border-primary/10">
                            <Brain className="w-20 h-20 text-primary animate-bounce-slow" />
                            <Sparkles className="absolute -top-2 -right-2 w-8 h-8 text-amber-400 animate-spin-slow" />
                        </div>
                    </div>

                    <div className="space-y-4 max-w-lg">
                        <h2 className="text-3xl font-black tracking-tight bg-gradient-to-r from-primary to-indigo-600 bg-clip-text text-transparent">
                            Crafting Your Journey
                        </h2>
                        <p className="text-muted-foreground text-lg leading-relaxed">
                            {generatingStatus || "Our AI is designing a personalized path based on your goals and preferences. This usually takes about 20-30 seconds."}
                        </p>
                    </div>

                    <div className="w-full max-w-xs space-y-2">
                        <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-primary/60 px-1">
                            <div className="flex items-center gap-2">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                                </span>
                                <span>{generatingStatus ? "Active Generation" : "Analyzing Subjects"}</span>
                            </div>
                            <span className="animate-pulse">Working...</span>
                        </div>
                        <Progress value={undefined} className="h-1.5 overflow-hidden" />
                    </div>

                    <div className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground/60 font-medium">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                            Synchronizing Goals
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
                            Optimizing Schedule
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div>
                            Curating Resources
                        </div>
                    </div>
                </div>
            </AppLayout>
        );
    }

    if (!plan) {
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title="Dashboard" />
                <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
                    <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
                    <h2 className="text-2xl font-bold">Welcome!</h2>
                    <p className="text-muted-foreground mt-2 max-w-md">
                        Your personalized study space is ready. Complete the onboarding to generate your first AI-powered study plan.
                    </p>
                    <Link href="/onboarding">
                        <Button className="mt-6">
                            Complete Setup
                        </Button>
                    </Link>
                </div>
            </AppLayout>
        );
    }

    const getSubjectDisplay = (s: { subject?: string; topic?: string } | any) => {
        if (!s) return 'Study Session';
        const v = typeof s.subject === 'string' ? s.subject : s.subject?.subject;
        const out = v ?? 'Study Session';
        return out === '[object Object]' || out === 'undefined' ? 'Study Session' : out;
    };
    const getTopicDisplay = (s: { topic?: string } | any) => {
        if (!s) return '';
        const v = typeof s.topic === 'string' ? s.topic : s.topic?.topic;
        if (v == null) return '';
        const str = String(v);
        return str === '[object Object]' ? '' : str.slice(0, 120);
    };

    const todayName = format(new Date(), 'EEEE');
    const rawSchedule = plan?.generated_plan?.schedule || (plan?.generated_plan as any)?.optimized_schedule || {};

    // Check if today is within plan range (guard against null dates)
    const planStart = plan.starts_on ? startOfDay(parseISO(plan.starts_on)) : startOfDay(new Date());
    const planEnd = plan.ends_on ? startOfDay(parseISO(plan.ends_on)) : startOfDay(new Date());
    const today = startOfDay(new Date());
    const isWithinRange = today >= planStart && today <= planEnd;

    // 1. Find today's data (handle numeric indices, direct keys, or nested day objects)
    let dayData: any = isWithinRange ? (rawSchedule[todayName] || Object.values(rawSchedule).find((v: any) => v[todayName])) : null;
    if (dayData && dayData[todayName]) dayData = dayData[todayName];

    // 2. Extract and sanitize sessions from plan
    const rawSessionsFromPlan = dayData?.sessions || (Array.isArray(dayData) ? dayData : []);
    const planSessions: DashboardSession[] = rawSessionsFromPlan
        .filter((s: any) => s != null)
        .map((s: any) => {
            if (typeof s === 'string') {
                const cleanContent = s.replace(/^\d{1,2}:\d{2}\s*(?:AM|PM)\s*-\s*\d{1,2}:\d{2}\s*(?:AM|PM):\s*/i, '');
                const subjectMatch = cleanContent.match(/^([^(\-]+)/);
                const subject = subjectMatch ? subjectMatch[1].trim() : 'Study Session';
                return {
                    subject: subject,
                    topic: cleanContent.trim(),
                    duration_minutes: 60,
                    focus_level: 'medium'
                };
            }
            return s;
        });

    // 3. Merge with active learning paths
    const lpSessions: DashboardSession[] = activeLearningPaths.map(lp => ({
        subject: lp.subject,
        topic: lp.topic,
        duration_minutes: lp.duration_minutes,
        is_learning_path: true,
        id: lp.id,
        focus_level: 'medium'
    }));

    // Combine: Prefer Learning Path session if it covers a subject also in the plan
    const filteredPlanSessions = planSessions.filter(ps =>
        !lpSessions.some(lps => lps.subject.toLowerCase() === ps.subject.toLowerCase())
    );

    const todaySessions = [...lpSessions, ...filteredPlanSessions].map(session => {
        const isDone = completedToday.some(cs => {
            if (session.is_learning_path && cs.learning_path_id === session.id) {
                return true;
            }
            return cs.subject.toLowerCase() === session.subject.toLowerCase() &&
                cs.topic?.toLowerCase() === session.topic?.toLowerCase();
        });
        return { ...session, isDone };
    });

    const totalMinutes = todaySessions.reduce((acc, s) => acc + (s.duration_minutes || 60), 0);
    const completedCount = todaySessions.filter(s => s.isDone).length;
    const progressPercent = todaySessions.length > 0
        ? Math.min(100, Math.round((completedCount / todaySessions.length) * 100))
        : 0;

    // 3. Upcoming Preview (Next 3 days)
    const upcomingDays = [1, 2, 3].map(offset => {
        const date = addDays(new Date(), offset);
        const dayName = format(date, 'EEEE');
        const isInRange = date >= planStart && date <= planEnd;

        let dayData: any = isInRange ? (rawSchedule[dayName] || Object.values(rawSchedule).find((v: any) => v[dayName])) : null;
        if (dayData && dayData[dayName]) dayData = dayData[dayName];

        const sessions = (dayData?.sessions || (Array.isArray(dayData) ? dayData : [])).map((s: any) => {
            if (s == null) return { subject: 'Study Session' };
            if (typeof s === 'string') return { subject: s.split(':')[0].trim() };
            return s;
        });

        return {
            date,
            dayName,
            sessions: sessions as { subject: string }[]
        };
    });

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dashboard" />

            {streakCelebration && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
                    <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-black/10 backdrop-blur-[2px] opacity-90"></div>

                    <div className="relative pointer-events-auto">
                        <div className="absolute inset-0 pointer-events-none">
                            {confettiPieces.map((piece) => (
                                <div
                                    key={piece.id}
                                    className={`confetti-piece ${piece.colorClass} blur-[0.2px]`}
                                    style={{
                                        left: `${piece.left}%`,
                                        animationDuration: `${piece.duration}s`,
                                        animationDelay: `${piece.delay}s`,
                                    }}
                                ></div>
                            ))}
                        </div>

                        <div className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl px-8 py-10 max-w-md text-center space-y-6 border border-white/20 animate-[streak-pop_0.5s_ease]">
                            <div className="flex justify-center">
                                <div className="inline-flex items-center gap-3 bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 px-5 py-2 rounded-full font-bold text-sm shadow-sm">
                                    <Flame className="w-5 h-5 text-orange-500 animate-pulse" />
                                    {streakCelebration.streak}-DAY STREAK
                                </div>
                            </div>
                            <div className="space-y-3">
                                <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                                    {getStreakHeadline(streakCelebration.milestone)}
                                </h2>
                                <p className="text-gray-600 dark:text-gray-400 text-base leading-relaxed">
                                    {getStreakSubtext(streakCelebration.milestone, streakCelebration.streak)}
                                </p>
                            </div>
                            <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 rounded-2xl px-4 py-4 flex items-center justify-between border border-orange-100 dark:border-orange-900/30">
                                <div className="text-left">
                                    <p className="text-sm font-bold text-orange-800 dark:text-orange-300">Keep the momentum!</p>
                                    <p className="text-xs text-orange-700/70 dark:text-orange-400/60 leading-tight">Come back tomorrow to level up 🚀</p>
                                </div>
                                <div className="p-2 bg-white dark:bg-orange-900/40 rounded-xl shadow-sm">
                                    <Sparkles className="w-6 h-6 text-orange-500" />
                                </div>
                            </div>
                            <Button onClick={dismissCelebration} size="lg" className="w-full bg-slate-900 hover:bg-black dark:bg-white dark:text-black dark:hover:bg-slate-200 text-white font-bold h-14 rounded-2xl transition-all hover:scale-[1.02] active:scale-95 shadow-lg">
                                Awesome! Let's stay on track
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
                {isBehindSchedule && !isGeneratingPlan && (
                    <Card className="bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800 overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <RefreshCw className="w-16 h-16 -mr-4 -mt-4" />
                        </div>
                        <CardContent className="p-4 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-amber-100 dark:bg-amber-900/40 rounded-xl text-amber-600 dark:text-amber-400">
                                    <AlertCircle className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-amber-900 dark:text-amber-200">Recovery Mode Needed</h3>
                                    <p className="text-amber-800/80 dark:text-amber-400/80 text-sm max-w-xl">
                                        You've fallen a bit behind your target schedule. Don't worry—Neuron AI can re-calculate your remaining days to ensure you still hit your goals.
                                    </p>
                                </div>
                            </div>
                            <Button
                                onClick={handleRebalance}
                                className="bg-amber-600 hover:bg-amber-700 text-white border-none shrink-0"
                                size="lg"
                            >
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Rebalance My Plan
                            </Button>
                        </CardContent>
                    </Card>
                )}

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2">
                    <div className="animate-fade-in">
                        <p className="text-sm uppercase tracking-[0.2em] text-primary/70 font-bold">{getGreeting(auth?.user?.name)}</p>
                        <h1 className="mt-1 text-4xl font-black tracking-tight text-slate-900 dark:text-slate-50">
                            {format(new Date(), 'MMMM do')}
                        </h1>
                        <p className="text-muted-foreground mt-2 text-base leading-relaxed max-w-2xl">
                            You're making great progress. Ready to tackle today's sessions?
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Progress Card */}
                    <Card className="relative overflow-hidden border-2 border-primary/10 group hover:border-primary/20 transition-colors">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Target className="w-20 h-20 -mr-6 -mt-6" />
                        </div>
                        <CardHeader className="pb-2">
                            <CardDescription className="font-bold uppercase tracking-wider text-[10px]">Daily Progress</CardDescription>
                            <CardTitle className="text-4xl font-black tabular-nums">{progressPercent}%</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="shimmer-wrapper rounded-full">
                                <Progress value={progressPercent} className={cn("h-2.5", progressPercent > 0 && "shimmer-active")} />
                            </div>
                            <div className="flex justify-between text-xs font-bold text-muted-foreground/80">
                                <span className="flex items-center gap-1.5">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                    {completedCount} / {todaySessions.length} sessions
                                </span>
                                <span>{formatDuration(totalMinutes)}</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Sparkles className="w-20 h-20 -mr-6 -mt-6" />
                        </div>
                        <CardHeader className="pb-2">
                            <CardDescription>Your Progress</CardDescription>
                            <CardTitle className="flex items-center justify-between gap-3">
                                <span className="text-2xl font-bold">Level {progress.xp.level}</span>
                                <Badge variant="secondary" className="gap-1">
                                    <StreakIcon streak={progress.streak.current} size="sm" />
                                    <span className={getStreakColor(progress.streak.current)}>
                                        {progress.streak.current === 0 ? 'No streak yet' : progress.streak.current === 1 ? '1 day streak' : `${progress.streak.current} day streak`}
                                    </span>
                                </Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
                                    <span>{progress.xp.total.toLocaleString()} XP</span>
                                    <span>{progress.xp.progress_percent}% to Level {progress.xp.level + 1}</span>
                                </div>
                                <div className="relative shimmer-wrapper rounded-full">
                                    <div
                                        className="absolute inset-0 rounded-full blur-[12px] opacity-20 bg-primary animate-pulse-slow"
                                        style={{ width: `${progress.xp.progress_percent}%` }}
                                    ></div>
                                    <Progress value={progress.xp.progress_percent} className={cn("h-2.5 relative z-10", progress.xp.progress_percent > 0 && "shimmer-active")} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className={cn('rounded-lg border bg-muted/30 p-3')}>
                                    <div className="text-xs uppercase tracking-wider text-muted-foreground">Best streak</div>
                                    <div className="mt-1 flex items-center gap-2">
                                        <StreakIcon streak={progress.streak.best} size="sm" />
                                        <span className={cn('text-lg font-bold', getStreakColor(progress.streak.best))}>
                                            {progress.streak.best === 0 ? 'None' : progress.streak.best === 1 ? '1 day' : `${progress.streak.best} days`}
                                        </span>
                                    </div>
                                </div>
                                <div className={cn('rounded-lg border bg-muted/30 p-3')}>
                                    <div className="text-xs uppercase tracking-wider text-muted-foreground">Weekly goal</div>
                                    <div className="mt-1 text-lg font-bold">
                                        {progress.sessions.week.target_percent == null ? '—' : `${progress.sessions.week.target_percent}%`}
                                    </div>
                                </div>
                            </div>

                            <p className="text-sm text-muted-foreground italic leading-relaxed">
                                {progress.insight}
                            </p>
                            {progress.streak.current > 0 && (
                                <div className="mt-3 p-3 rounded-lg bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-950/20 dark:to-yellow-950/20 border border-orange-200 dark:border-orange-800">
                                    <p className="text-sm font-medium text-orange-800 dark:orange-200">
                                        🔥 {getStreakMessage(progress.streak.current)}
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* AI Insight */}
                    <Card className="bg-gradient-to-br from-indigo-500/10 via-primary/5 to-slate-100 dark:to-slate-900 border-primary/20 shadow-lg">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base uppercase tracking-wider text-primary flex items-center gap-2">
                                <Brain className="w-4 h-4" />
                                Quick Actions
                            </CardTitle>
                            <CardDescription className="text-muted-foreground">
                                Start studying or practice with a quiz
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <Button asChild size="lg" className="w-full justify-between bg-gradient-to-r from-primary to-indigo-600 text-primary-foreground hover:shadow-lg hover:shadow-primary/20 transition-all duration-300 relative overflow-hidden group">
                                <Link href="/study-planner" className="flex w-full items-center justify-between relative z-10">
                                    Start next session
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity animate-pulse"></div>
                                </Link>
                            </Button>
                            <Button asChild variant="secondary" size="lg" className="w-full justify-between">
                                <Link href="/quiz-practice" className="flex w-full items-center justify-between">
                                    Practice quiz
                                    <Sparkles className="w-4 h-4" />
                                </Link>
                            </Button>
                            <div className="rounded-xl border border-primary/20 bg-white/70 dark:bg-slate-900/40 p-3 text-sm text-muted-foreground leading-relaxed">
                                💡 Quick review after studying helps you remember 70% more.
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Section: Today's Tasks */}
                    <div className="lg:col-span-2 space-y-4">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-primary" />
                            Today's Sessions
                        </h2>

                        {todaySessions.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {todaySessions.map((session, idx) => {
                                    const isDone = session.isDone;
                                    const subColor = getSubjectColor(getSubjectDisplay(session));

                                    return (
                                        <Card
                                            key={idx}
                                            className={cn(
                                                "transition-all duration-500 group border-border/50 bg-card/60 backdrop-blur-xl hover:scale-[1.03] hover:shadow-2xl hover:shadow-primary/10 cursor-pointer overflow-hidden active-press border-2 hover:border-primary/20",
                                                isDone && "opacity-60 grayscale hover:scale-100 shadow-none border-transparent is-done"
                                            )}
                                        >
                                            <div className={cn("absolute inset-y-0 left-0 w-1.5 transition-all duration-500 group-hover:w-2", subColor.primary, isDone ? "opacity-20" : "opacity-100")}></div>
                                            <CardContent className="p-5 flex items-center gap-4 relative z-10">
                                                {isDone ? (
                                                    <div className="bg-emerald-500/20 p-1.5 rounded-full scale-110 shadow-sm">
                                                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                                    </div>
                                                ) : (
                                                    <div className={cn("w-6 h-6 rounded-full border-2 transition-all duration-300 group-hover:scale-110 group-hover:border-primary shadow-sm", subColor.border)} />
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <h4 className={cn("text-lg font-black truncate transition-all duration-300", !isDone && "group-hover:translate-x-1", isDone && 'text-muted-foreground line-through decoration-emerald-500/50 decoration-2')}>
                                                        <span className="strikethrough-animate">{getSubjectDisplay(session)}</span>
                                                    </h4>
                                                    <p className="text-sm font-medium text-muted-foreground/80 truncate mt-0.5">
                                                        {getTopicDisplay(session)}
                                                    </p>
                                                </div>
                                                <Badge variant="outline" className={cn("text-xs font-black px-2.5 py-1 rounded-lg border-2 transition-all duration-300", !isDone && subColor.bg + " " + subColor.text + " " + subColor.border + " group-hover:shadow-md")}>
                                                    {formatDuration(session.duration_minutes)}
                                                </Badge>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        ) : futureLearningPaths && futureLearningPaths.length > 0 ? (
                            <div className="w-full">
                                <Card className="border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 transition-all duration-300 group cursor-pointer" onClick={() => router.visit('/study-planner')}>
                                    <CardContent className="p-10 flex flex-col items-center text-center space-y-6">
                                        <div className="relative">
                                            <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl animate-pulse"></div>
                                            <div className="relative p-6 rounded-2xl bg-white dark:bg-slate-900 border border-primary/10 shadow-2xl group-hover:scale-110 transition-transform duration-500">
                                                <Calendar className="w-10 h-10 text-primary" />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <h4 className="text-2xl font-black tracking-tight">Your journey begins soon!</h4>
                                            <p className="text-muted-foreground text-lg max-w-md leading-relaxed">
                                                <span className="text-foreground font-bold">{futureLearningPaths[0].subject_name}</span> is scheduled to start on <span className="text-primary font-bold">{format(parseISO(futureLearningPaths[0].start_date), 'MMMM do')}</span>.
                                            </p>
                                            <p className="text-muted-foreground/60 text-sm">
                                                Enjoy the calm before the focus! 🧘‍♂️
                                            </p>
                                        </div>
                                        <Button asChild size="lg" className="bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all rounded-xl px-8">
                                            <Link href="/study-planner">View Scheduled Plan</Link>
                                        </Button>
                                    </CardContent>
                                </Card>
                            </div>
                        ) : (
                            <Card className="border-dashed border-border/60 bg-muted/5">
                                <CardContent className="p-12 text-center flex flex-col items-center space-y-4">
                                    <div className="p-4 rounded-full bg-muted/20">
                                        <Zap className="w-12 h-12 text-muted-foreground/40" />
                                    </div>
                                    <h4 className="text-lg font-semibold">No sessions scheduled for today</h4>
                                    <p className="text-muted-foreground max-w-sm">
                                        Great job! You've cleared your schedule. Use this time to review or start something new.
                                    </p>
                                    <Button asChild variant="outline" className="mt-2">
                                        <Link href="/onboarding">Enroll in New Subject</Link>
                                    </Button>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* Sidebar: Upcoming Glimpse */}
                    <div className="space-y-4">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Clock className="w-5 h-5 text-primary" />
                            Upcoming
                        </h2>
                        <div className="space-y-3">
                            {upcomingDays.map((day, idx) => (
                                <Card key={idx} className="bg-muted/30 border-none shadow-none">
                                    <CardContent className="p-3">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-sm font-bold uppercase tracking-tighter text-muted-foreground">
                                                {format(day.date, 'eee, MMM d')}
                                            </span>
                                            <Badge variant="secondary" className="text-xs px-1 h-4">
                                                {day.sessions.length} session{day.sessions.length === 1 ? '' : 's'}
                                            </Badge>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {day.sessions.length > 0 ? (
                                                day.sessions.map((s, i) => (
                                                    <span key={i} className="text-xs bg-background px-2 py-0.5 rounded border text-foreground/80">
                                                        {getSubjectDisplay(s)}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-xs text-muted-foreground italic">Free day</span>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                        <Link href="/study-planner" className="block">
                            <Button variant="ghost" className="w-full text-sm text-primary hover:text-primary hover:bg-primary/5">
                                View full schedule
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>
        </AppLayout >
    );
}
