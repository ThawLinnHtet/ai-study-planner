import { Head } from '@inertiajs/react';
import { Link } from '@inertiajs/react';
import { router } from '@inertiajs/react';
import { format, parseISO, startOfDay, addDays } from 'date-fns';
import {
    Zap,
    Calendar,
    CheckCircle2,
    Clock,
    ArrowRight,
    Target,
    Brain,
    AlertCircle
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import AppLayout from '@/layouts/app-layout';
import { cn, formatDuration } from '@/lib/utils';
import { dashboard } from '@/routes';
import type { BreadcrumbItem } from '@/types';

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
    };
}

interface CompletedSession {
    id: number;
}

interface Props {
    plan?: Plan;
    completedToday: CompletedSession[];
    onboardingCompleted: boolean;
}

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: dashboard().url,
    },
];

export default function Dashboard({ plan, completedToday, onboardingCompleted }: Props) {
    const [refreshCount, setRefreshCount] = useState(0);
    const [isChecking, setIsChecking] = useState(false);

    // Auto-refresh to check for plan creation (only if onboarding is completed)
    useEffect(() => {
        if (!plan && onboardingCompleted && refreshCount < 10) { // Check up to 10 times
            const timer = setTimeout(() => {
                setIsChecking(true);
                router.reload({ only: ['plan'] });
                setRefreshCount(prev => prev + 1);
            }, 3000); // Check every 3 seconds

            return () => clearTimeout(timer);
        }
    }, [plan, onboardingCompleted, refreshCount]);

    if (!plan) {
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title="Dashboard" />
                <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
                    {onboardingCompleted ? (
                        <>
                            <Brain className="w-12 h-12 text-primary mb-4 animate-pulse" />
                            <h2 className="text-2xl font-bold">Creating Your Study Plan...</h2>
                            <p className="text-muted-foreground mt-2 max-w-md">
                                Neuron AI is crafting your personalized study schedule. This usually takes a few moments.
                            </p>
                            <div className="mt-6 space-y-2">
                                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                                    <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {isChecking ? 'Checking for your plan...' : 'Please wait while we generate your plan...'}
                                </p>
                                {refreshCount > 5 && (
                                    <p className="text-xs text-amber-600">Taking longer than expected - AI is working hard!</p>
                                )}
                            </div>
                            <div className="mt-8 space-y-4">
                                <Link href="/study-planner">
                                    <Button variant="outline">
                                        Check Study Planner
                                    </Button>
                                </Link>
                                <div className="text-center space-y-2">
                                    <button
                                        onClick={() => router.reload()}
                                        className="text-sm text-muted-foreground hover:text-primary"
                                    >
                                        Refresh manually
                                    </button>
                                    <div>
                                        <Link href="/onboarding" className="text-sm text-muted-foreground hover:text-primary block">
                                            Need to adjust your onboarding settings?
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
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
                        </>
                    )}
                </div>
            </AppLayout>
        );
    }

    const getSubjectDisplay = (s: unknown) => {
        if (!s || typeof s !== 'object') return 'Study Session';
        const record = s as { subject?: unknown };
        let value = record.subject;

        if (value && typeof value === 'object' && 'subject' in (value as { subject?: unknown })) {
            value = (value as { subject?: unknown }).subject;
        }

        if (typeof value !== 'string') return 'Study Session';
        if (value === '[object Object]' || value === 'undefined') return 'Study Session';
        return value;
    };
    const getTopicDisplay = (s: unknown) => {
        if (!s || typeof s !== 'object') return '';
        const record = s as { topic?: unknown };
        let value = record.topic;

        if (value && typeof value === 'object' && 'topic' in (value as { topic?: unknown })) {
            value = (value as { topic?: unknown }).topic;
        }

        if (typeof value !== 'string') return '';
        const str = value;
        return str === '[object Object]' ? '' : str.slice(0, 120);
    };

    const todayName = format(new Date(), 'EEEE');
    const rawScheduleSource =
        plan?.generated_plan?.schedule ??
        (plan?.generated_plan as { optimized_schedule?: Record<string, unknown> })?.optimized_schedule ??
        {};
    const rawSchedule = rawScheduleSource as Record<string, unknown>;

    // Check if today is within plan range (guard against null dates)
    const planStart = plan.starts_on ? startOfDay(parseISO(plan.starts_on)) : startOfDay(new Date());
    const planEnd = plan.ends_on ? startOfDay(parseISO(plan.ends_on)) : startOfDay(new Date());
    const today = startOfDay(new Date());
    const isWithinRange = today >= planStart && today <= planEnd;

    const resolveDayData = (schedule: Record<string, unknown>, dayName: string): unknown => {
        if (dayName in schedule) {
            return schedule[dayName];
        }

        for (const value of Object.values(schedule)) {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                const record = value as Record<string, unknown>;
                if (dayName in record) {
                    return record[dayName];
                }
            }
        }

        return null;
    };

    const unwrapDayData = (data: unknown, dayName: string): unknown => {
        if (data && typeof data === 'object' && !Array.isArray(data)) {
            const record = data as Record<string, unknown>;
            if (dayName in record) {
                return record[dayName];
            }
        }
        return data;
    };

    const normalizeSessions = (data: unknown): Session[] => {
        const collected: unknown[] = [];

        if (Array.isArray(data)) {
            collected.push(...data);
        } else if (data && typeof data === 'object') {
            const record = data as Record<string, unknown>;
            if (Array.isArray(record.sessions)) {
                collected.push(...record.sessions);
            }
        }

        return collected
            .filter((value): value is string | Session => value != null)
            .map((value) => {
                if (typeof value === 'string') {
                    const cleanContent = value.replace(
                        /^\d{1,2}:\d{2}\s*(?:AM|PM)\s*-\s*\d{1,2}:\d{2}\s*(?:AM|PM):\s*/i,
                        '',
                    );

                    const subjectMatch = cleanContent.match(/^([^(-]+)/);
                    const subject = subjectMatch ? subjectMatch[1].trim() : 'Study Session';

                    return {
                        subject: subject,
                        topic: cleanContent.trim(),
                        duration_minutes: 60,
                        focus_level: 'medium',
                    };
                }

                return value as Session;
            });
    };

    const dayDataRaw = isWithinRange ? resolveDayData(rawSchedule, todayName) : null;
    const dayData = unwrapDayData(dayDataRaw, todayName);

    const rawSessionsToday = normalizeSessions(dayData);
    const todaySessions: Session[] = rawSessionsToday;
    const totalMinutes = todaySessions.reduce((acc, s) => acc + s.duration_minutes, 0);
    const completedCount = completedToday.length;
    const progressPercent = todaySessions.length > 0
        ? Math.round((completedCount / todaySessions.length) * 100)
        : 0;

    // 3. Upcoming Preview (Next 3 days)
    const upcomingDays = [1, 2, 3].map(offset => {
        const date = addDays(new Date(), offset);
        const dayName = format(date, 'EEEE');
        const isInRange = date >= planStart && date <= planEnd;

        const dayDataRawInner = isInRange ? resolveDayData(rawSchedule, dayName) : null;
        const dayDataInner = unwrapDayData(dayDataRawInner, dayName);

        const sessions = normalizeSessions(dayDataInner).map((s) => ({
            subject: getSubjectDisplay(s),
        }));

        return {
            date,
            dayName,
            sessions: sessions as { subject: string }[]
        };
    });

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dashboard" />

            <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Welcome back!</h1>
                        <p className="text-muted-foreground mt-1">Here is your study overview for {format(new Date(), 'EEEE, MMMM do')}.</p>
                    </div>
                    <Link href="/study-planner">
                        <Button className="flex items-center gap-2">
                            View Full Planner
                            <ArrowRight className="w-4 h-4" />
                        </Button>
                    </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Progress Card */}
                    <Card className="relative overflow-hidden border-2 border-primary/10">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Target className="w-20 h-20 -mr-6 -mt-6" />
                        </div>
                        <CardHeader className="pb-2">
                            <CardDescription>Daily Progress</CardDescription>
                            <CardTitle className="text-4xl font-bold">{progressPercent}%</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Progress value={progressPercent} className="h-2" />
                            <div className="flex justify-between text-sm text-muted-foreground">
                                <span>{completedCount} of {todaySessions.length} sessions done</span>
                                <span>{formatDuration(totalMinutes)} total</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Streak / Stats */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Next Session</CardDescription>
                            <CardTitle className="flex items-center gap-2">
                                <Clock className="w-5 h-5 text-primary" />
                                {(() => {
                                    const next = todaySessions.find((_, i) => i >= completedCount);
                                    return next ? getSubjectDisplay(next) : 'Done for today!';
                                })()}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-2 mt-2">
                                <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none">
                                    <Zap className="w-3 h-3 mr-1 fill-amber-500 text-amber-500" />
                                    Focus Mode
                                </Badge>
                                <span className="text-sm text-muted-foreground">Ready to start?</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* AI Insight */}
                    <Card className="bg-primary/5 border-primary/20">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm uppercase tracking-wider text-primary flex items-center gap-2">
                                <Brain className="w-4 h-4" />
                                Neuron Insight
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm italic text-muted-foreground leading-relaxed">
                                {plan?.generated_plan?.strategy_summary?.substring(0, 120) || 'Your personalized study strategy is being refined...'}
                                {(plan?.generated_plan?.strategy_summary?.length ?? 0) > 120 ? '...' : ''}
                            </p>
                            <Link href="/study-planner" className="text-xs text-primary font-bold mt-4 inline-block hover:underline">
                                READ STRATEGY
                            </Link>
                        </CardContent>
                    </Card>
                </div>

                {/* Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Section: Today's Tasks */}
                    <div className="lg:col-span-2 space-y-4">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-primary" />
                            Today's Focus
                        </h2>

                        {todaySessions.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {todaySessions.map((session, idx) => {
                                    const isDone = idx < completedCount;
                                    return (
                                        <Card key={idx} className={cn("transition-all", isDone && "opacity-50 grayscale")}>
                                            <CardContent className="p-4 flex items-center gap-4">
                                                {isDone ? (
                                                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                                                ) : (
                                                    <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/30" />
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <h4 className={`font-bold truncate ${isDone ? 'line-through' : ''}`}>
                                                        {getSubjectDisplay(session)}
                                                    </h4>
                                                    <p className="text-xs text-muted-foreground truncate">
                                                        {getTopicDisplay(session)}
                                                    </p>
                                                </div>
                                                <Badge variant="outline" className="text-[10px]">
                                                    {formatDuration(session.duration_minutes)}
                                                </Badge>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="p-12 text-center border-2 border-dashed rounded-xl flex flex-col items-center">
                                <Zap className="w-12 h-12 text-muted-foreground/30 mb-4" />
                                <p className="text-muted-foreground">No sessions scheduled for today. Rest up!</p>
                            </div>
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
                                            <span className="text-xs font-bold uppercase tracking-tighter text-muted-foreground">
                                                {format(day.date, 'eee, MMM d')}
                                            </span>
                                            <Badge variant="secondary" className="text-[9px] px-1 h-4">
                                                {day.sessions.length} sessions
                                            </Badge>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {day.sessions.length > 0 ? (
                                                day.sessions.map((s, i) => (
                                                    <span key={i} className="text-[11px] bg-background px-2 py-0.5 rounded border text-foreground/80">
                                                        {getSubjectDisplay(s)}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-[11px] text-muted-foreground italic">Rest day</span>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                        <Link href="/study-planner" className="block">
                            <Button variant="ghost" className="w-full text-xs text-primary hover:text-primary hover:bg-primary/5">
                                View full schedule
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
