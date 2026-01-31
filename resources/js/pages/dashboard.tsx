import { Head } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import type { BreadcrumbItem } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
import { Button } from '@/components/ui/button';
import { Link } from '@inertiajs/react';
import { format, parseISO, startOfDay, addDays } from 'date-fns';
import { cn, formatDuration } from '@/lib/utils';

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
}

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: dashboard().url,
    },
];

export default function Dashboard({ plan, completedToday }: Props) {
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

    // 2. Extract and sanitize sessions
    const rawSessions = dayData?.sessions || (Array.isArray(dayData) ? dayData : []);
    const todaySessions: Session[] = rawSessions
        .filter((s: any) => s != null)
        .map((s: any) => {
            if (typeof s === 'string') {
                // Regex to strip time range: "6:00 PM - 7:00 PM: Typebox" -> "Typebox"
                const cleanContent = s.replace(/^\d{1,2}:\d{2}\s*(?:AM|PM)\s*-\s*\d{1,2}:\d{2}\s*(?:AM|PM):\s*/i, '');

                // Extract subject (text before first paren or dash)
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
