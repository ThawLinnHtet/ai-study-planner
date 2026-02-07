import { Head, useForm } from '@inertiajs/react';
import {
    format,
    startOfWeek,
    addDays,
    addMonths,
    subMonths,
    isSameDay,
    isToday,
    parseISO,
    startOfDay,
    startOfMonth,
    endOfMonth,
    endOfWeek
} from 'date-fns';
import {
    CheckCircle2,
    Circle,
    Clock,
    Calendar as CalendarIcon,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    AlertCircle,
    BookOpen,
    Flame,
    Sparkles,
    Link2,
    Trophy,
    Target,
    Zap,
    TrendingUp,
    Crown,
    Calendar,
    ChevronDown,
    Layers
} from 'lucide-react';
import { useState, useMemo, useEffect, useRef } from 'react';
import Heading from '@/components/heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from '@/hooks/use-toast';
import AppLayout from '@/layouts/app-layout';
import { cn, formatDuration } from '@/lib/utils';
import type { BreadcrumbItem } from '@/types';

interface Session {
    subject: string;
    topic: string;
    duration_minutes: number;
    focus_level: 'low' | 'medium' | 'high';
    key_topics?: string[];
    resources?: {
        title: string;
        url: string;
        type: string;
    }[];
}

interface DayPlan {
    sessions: Session[];
}

interface Plan {
    id: number;
    title: string;
    goal: string;
    status: string;
    starts_on: string;
    ends_on: string;
    generated_plan: {
        schedule: Record<string, DayPlan>;
        strategy_summary: string;
    };
}

interface CompletedSession {
    started_at: string;
    meta: {
        subject_name: string;
        topic_name: string;
    };
}

interface Props {
    plan?: Plan;
    completedSessions: CompletedSession[];
    examDates: Record<string, string | null>;
    progress: {
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
        };
        insight: string;
    };
}

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Study Planner',
        href: '/study-planner',
    },
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function StudyPlanner({ plan, completedSessions, examDates, progress }: Props) {
    const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
    const [viewMode, setViewMode] = useState<'month' | 'week'>('week');
    const [hoveredWeek, setHoveredWeek] = useState<number | null>(null);
    const cardRef = useRef<HTMLDivElement>(null);
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });

    // Calculate month data
    const monthStart = startOfMonth(selectedDate);
    const monthEnd = endOfMonth(selectedDate);
    const monthDays = useMemo(() => {
        const days = [];
        const start = startOfWeek(monthStart, { weekStartsOn: 1 });
        const end = endOfWeek(monthEnd, { weekStartsOn: 1 });

        for (let day = start; day <= end; day = addDays(day, 1)) {
            days.push(day);
        }
        return days;
    }, [selectedDate]);

    // Calculate weeks in month
    const weeksInMonth = useMemo(() => {
        const weeks = [];
        const start = startOfWeek(monthStart, { weekStartsOn: 1 });

        for (let i = 0; i < 6; i++) {
            const weekStart = addDays(start, i * 7);
            const weekEnd = addDays(weekStart, 6);

            if (weekStart <= monthEnd) {
                weeks.push({
                    start: weekStart,
                    end: weekEnd,
                    days: Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
                });
            }
        }
        return weeks;
    }, [selectedDate]);

    // Get sessions for a specific date
    const getSessionsForDate = (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        return plan?.generated_plan?.schedule[dateStr]?.sessions || [];
    };


    const form = useForm({
        subject: '',
        topic: '',
        duration_minutes: 0,
        started_at: '',
        status: 'completed' as 'completed' | 'pending'
    });

    const rebalanceForm = useForm({});



    const weekDays = useMemo(() => {
        return DAYS.map((day, index) => {
            const date = addDays(weekStart, index);
            return {
                name: day,
                date: date,
                isToday: isToday(date),
            };
        });
    }, [weekStart]);

    const isCompleted = (date: Date, subject: string, topic: string) => {
        return completedSessions.some(session => {
            if (!session.started_at) return false;
            const sessionDate = startOfDay(parseISO(session.started_at));
            const targetDate = startOfDay(date);
            return isSameDay(sessionDate, targetDate) &&
                session.meta.subject_name === subject &&
                session.meta.topic_name === topic;
        });
    };

    const toggleSession = (date: Date, session: Session) => {
        const completed = isCompleted(date, session.subject, session.topic);

        form.setData({
            subject: getSubjectDisplay(session),
            topic: getTopicDisplay(session),
            duration_minutes: session.duration_minutes ?? 60,
            started_at: format(date, "yyyy-MM-dd HH:mm:ss"),
            status: completed ? 'pending' : 'completed'
        });

        form.post(route('study-plan.toggle-session'), {
            preserveScroll: true
        });
    };

    // Calculate days until exam for a subject
    const getExamInfo = (subject: string): { daysUntil: number | null; isNear: boolean } => {
        const examDate = examDates[subject];
        if (!examDate) return { daysUntil: null, isNear: false };

        const today = new Date();
        const exam = new Date(examDate);
        const diffTime = exam.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return {
            daysUntil: diffDays,
            isNear: diffDays > 0 && diffDays <= 14
        };
    };

    const handleRebalance = () => {
        if (confirm('Neuron AI will analyze your recent progress and re-adjust your future schedule. Continue?')) {
            rebalanceForm.post(route('study-plan.rebalance'));
        }
    };

    if (!plan) {
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
                    <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
                    <h2 className="text-2xl font-bold">No active study plan found</h2>
                    <p className="text-muted-foreground mt-2 max-w-md">
                        Complete the onboarding process or create a new plan to get started with Neuron AI.
                    </p>
                    <Button className="mt-6" onClick={() => window.location.href = '/onboarding'}>
                        Start Onboarding
                    </Button>
                </div>
            </AppLayout>
        );
    }

    const currentDayName = format(selectedDate, 'EEEE');
    const rawScheduleSource =
        plan.generated_plan.schedule ??
        (plan.generated_plan as { optimized_schedule?: Record<string, unknown> }).optimized_schedule ??
        {};
    const rawSchedule = rawScheduleSource as Record<string, unknown>;

    // Check if the selected date is within the plan's life span (guard against null dates)
    const planStart = plan.starts_on ? startOfDay(parseISO(plan.starts_on)) : startOfDay(selectedDate);
    const planEnd = plan.ends_on ? startOfDay(parseISO(plan.ends_on)) : startOfDay(selectedDate);
    const targetDate = startOfDay(selectedDate);
    const isWithinRange = targetDate >= planStart && targetDate <= planEnd;

    // 1. Find the day object (handle both numeric indices and direct day names)
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
                        key_topics: [],
                        resources: [],
                    };
                }

                return value as Session;
            });
    };

    const dayDataRaw = isWithinRange ? resolveDayData(rawSchedule, currentDayName) : null;
    const dayData = unwrapDayData(dayDataRaw, currentDayName);
    const todaySessions = normalizeSessions(dayData);

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
        return str === '[object Object]' ? '' : str.slice(0, 200);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Study Planner" />

            <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
                {/* Premium Header */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-500/90 via-purple-500/85 to-indigo-600/90 text-white p-6 md:p-8 shadow-2xl dark:from-violet-600 dark:via-purple-600 dark:to-indigo-700 animate-fade-in">
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50 animate-pulse-slow"></div>
                    <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="space-y-2 slide-in-left">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm border border-white/10 shadow-lg animate-float">
                                    <Crown className="w-6 h-6 text-yellow-300" />
                                </div>
                                <span className="text-base font-medium text-white/90 uppercase tracking-wider animate-fade-in-up delay-50">Neuron AI Powered</span>
                            </div>
                            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent animate-fade-in-up delay-100">{plan.title}</h1>
                            <p className="text-white/90 max-w-lg animate-fade-in-up delay-150">{progress.insight}</p>
                        </div>
                        <Button
                            variant="secondary"
                            size="lg"
                            onClick={handleRebalance}
                            disabled={rebalanceForm.processing}
                            className="bg-white/25 backdrop-blur-sm border-white/40 text-white hover:bg-white/35 dark:bg-white/20 dark:border-white/30 dark:hover:bg-white/30 shadow-lg hover:shadow-xl transition-all duration-150 hover:scale-105 animate-fade-in-up delay-200"
                        >
                            <RefreshCw className={cn("w-4 h-4 mr-2", rebalanceForm.processing && "animate-spin")} />
                            Re-balance with AI
                        </Button>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="group relative overflow-hidden bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/20 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-150 hover:scale-105 hover:border-amber-500/30 animate-fade-in-up delay-250 card-tilt">
                        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-150"></div>
                        <CardContent className="p-4 relative">
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <svg className="w-12 h-12 transform -rotate-90">
                                        <circle
                                            cx="24"
                                            cy="24"
                                            r="20"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                            fill="none"
                                            className="text-amber-200"
                                        />
                                        <circle
                                            cx="24"
                                            cy="24"
                                            r="20"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                            fill="none"
                                            className="text-amber-500 animate-progress-ring"
                                            style={{
                                                '--progress': '0.75',
                                                strokeDasharray: '125.6',
                                                strokeDashoffset: '31.4'
                                            } as React.CSSProperties}
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Trophy className="w-5 h-5 text-amber-600" />
                                    </div>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground uppercase tracking-wider font-medium">Level</p>
                                    <p className="text-xl font-bold text-amber-600">{progress.xp.level}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="group relative overflow-hidden bg-gradient-to-br from-rose-500/10 to-red-500/10 border-rose-500/20 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-150 hover:scale-105 hover:border-rose-500/30 animate-fade-in-up delay-300 card-tilt">
                        <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-150"></div>
                        <CardContent className="p-4 relative">
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <svg className="w-12 h-12 transform -rotate-90">
                                        <circle
                                            cx="24"
                                            cy="24"
                                            r="20"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                            fill="none"
                                            className="text-rose-200"
                                        />
                                        <circle
                                            cx="24"
                                            cy="24"
                                            r="20"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                            fill="none"
                                            className="text-rose-500 animate-progress-ring"
                                            style={{
                                                '--progress': Math.min(progress.streak.current / 30, 1).toString(),
                                                strokeDasharray: '125.6',
                                                strokeDashoffset: `${125.6 * (1 - Math.min(progress.streak.current / 30, 1))}`
                                            } as React.CSSProperties}
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Flame className="w-5 h-5 text-rose-600" />
                                    </div>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground uppercase tracking-wider font-medium">Streak</p>
                                    <p className="text-xl font-bold text-rose-600">{progress.streak.current}d</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="group relative overflow-hidden bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-emerald-500/20 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-150 hover:scale-105 hover:border-emerald-500/30 animate-fade-in-up delay-350 card-tilt">
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-150"></div>
                        <CardContent className="p-4 relative">
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <svg className="w-12 h-12 transform -rotate-90">
                                        <circle
                                            cx="24"
                                            cy="24"
                                            r="20"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                            fill="none"
                                            className="text-emerald-200"
                                        />
                                        <circle
                                            cx="24"
                                            cy="24"
                                            r="20"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                            fill="none"
                                            className="text-emerald-500 animate-progress-ring"
                                            style={{
                                                '--progress': (progress.xp.progress_percent / 100).toString(),
                                                strokeDasharray: '125.6',
                                                strokeDashoffset: `${125.6 * (1 - progress.xp.progress_percent / 100)}`
                                            } as React.CSSProperties}
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Zap className="w-5 h-5 text-emerald-600" />
                                    </div>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground uppercase tracking-wider font-medium">XP Points</p>
                                    <p className="text-xl font-bold text-emerald-600">{progress.xp.total.toLocaleString()}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="group relative overflow-hidden bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-150 hover:scale-105 hover:border-blue-500/30 animate-fade-in-up delay-400 card-tilt">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-150"></div>
                        <CardContent className="p-4 relative">
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <svg className="w-12 h-12 transform -rotate-90">
                                        <circle
                                            cx="24"
                                            cy="24"
                                            r="20"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                            fill="none"
                                            className="text-blue-200"
                                        />
                                        <circle
                                            cx="24"
                                            cy="24"
                                            r="20"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                            fill="none"
                                            className="text-blue-500 animate-progress-ring"
                                            style={{
                                                '--progress': (progress.xp.progress_percent / 100).toString(),
                                                strokeDasharray: '125.6',
                                                strokeDashoffset: `${125.6 * (1 - progress.xp.progress_percent / 100)}`
                                            } as React.CSSProperties}
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <TrendingUp className="w-5 h-5 text-blue-600" />
                                    </div>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground uppercase tracking-wider font-medium">Progress</p>
                                    <p className="text-xl font-bold text-blue-600">{progress.xp.progress_percent}%</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Premium Hybrid Navigation - Ultra Compact */}
                <div className="relative animate-fade-in-up delay-450">
                    {/* Single Row Header with Toggle */}
                    <div className="flex items-center justify-between gap-4 mb-2 bg-gradient-to-r from-card/50 to-card/30 backdrop-blur-sm rounded-xl p-2 border border-border/50">
                        <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-foreground">
                                {format(selectedDate, 'MMMM yyyy')}
                            </h3>
                            <Badge variant="outline" className="text-base px-1.5 py-0 bg-primary/5 border-primary/20">
                                {viewMode === 'month' ? 'Month' : 'Week'}
                            </Badge>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Animated Toggle Switch */}
                            <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
                                <button
                                    onClick={() => setViewMode('month')}
                                    className={cn(
                                        "relative px-2 py-1 rounded text-base font-medium transition-all duration-200 flex items-center gap-1",
                                        viewMode === 'month'
                                            ? "bg-primary text-primary-foreground shadow-md"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <Calendar className="w-3 h-3" />
                                    <span>Month</span>
                                </button>
                                <button
                                    onClick={() => setViewMode('week')}
                                    className={cn(
                                        "relative px-2 py-1 rounded text-base font-medium transition-all duration-200 flex items-center gap-1",
                                        viewMode === 'week'
                                            ? "bg-primary text-primary-foreground shadow-md"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <CalendarIcon className="w-3 h-3" />
                                    <span>Week</span>
                                </button>
                            </div>

                            {/* Quick Jump Button */}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setSelectedDate(startOfDay(new Date()));
                                    setViewMode('week');
                                }}
                                className="h-6 px-2 text-base hover:bg-primary/10 hover:text-primary font-semibold"
                            >
                                Today
                            </Button>
                        </div>
                    </div>

                    {viewMode === 'month' ? (
                        /* Premium Month View - Ultra Compact */
                        <Card className="border-0 shadow-lg backdrop-blur-sm overflow-hidden bg-card/50">
                            <CardContent className="p-2">
                                {/* Navigation Row */}
                                <div className="flex items-center justify-between mb-2">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setSelectedDate(subMonths(selectedDate, 1))}
                                        className="h-6 w-6 hover:bg-primary/10 hover:text-primary"
                                    >
                                        <ChevronLeft className="w-3 h-3" />
                                    </Button>
                                    <span className="text-sm font-semibold">{format(selectedDate, 'MMM yyyy')}</span>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setSelectedDate(addMonths(selectedDate, 1))}
                                        className="h-6 w-6 hover:bg-primary/10 hover:text-primary"
                                    >
                                        <ChevronRight className="w-3 h-3" />
                                    </Button>
                                </div>

                                {/* Weekday Headers */}
                                <div className="grid grid-cols-7 gap-1 mb-1">
                                    {DAYS.map((day) => (
                                        <div key={day} className="text-center text-sm font-bold text-muted-foreground uppercase">
                                            {day.substring(0, 1)}
                                        </div>
                                    ))}
                                </div>

                                {/* Month Days - Ultra Compact */}
                                <div className="space-y-0.5">
                                    {weeksInMonth.map((week, weekIdx) => (
                                        <div
                                            key={weekIdx}
                                            className={cn(
                                                "group grid grid-cols-7 gap-1 p-1 rounded-lg transition-all duration-200 cursor-pointer",
                                                hoveredWeek === weekIdx && "bg-primary/5",
                                                "hover:bg-muted/30"
                                            )}
                                            onClick={() => {
                                                setSelectedDate(week.start);
                                                setViewMode('week');
                                            }}
                                            onMouseEnter={() => setHoveredWeek(weekIdx)}
                                            onMouseLeave={() => setHoveredWeek(null)}
                                        >
                                            {week.days.map((day, dayIdx) => {
                                                const sessions = getSessionsForDate(day);
                                                const isCurrentMonth = day.getMonth() === selectedDate.getMonth();
                                                const isSelected = isSameDay(day, selectedDate);
                                                const dayIsToday = isToday(day);

                                                return (
                                                    <button
                                                        key={dayIdx}
                                                        onClick={() => setSelectedDate(day)}
                                                        className={cn(
                                                            "relative flex flex-col items-center justify-center p-1 rounded transition-all duration-150 min-h-[32px]",
                                                            !isCurrentMonth && "opacity-30",
                                                            isSelected && "bg-primary text-primary-foreground shadow-md ring-1 ring-primary/50",
                                                            dayIsToday && !isSelected && "ring-1 ring-primary/50 bg-primary/5",
                                                            sessions.length > 0 && !isSelected && "bg-primary/5",
                                                            "hover:bg-muted/50 hover:scale-105 cursor-pointer"
                                                        )}
                                                    >
                                                        <span className={cn(
                                                            "text-sm font-semibold",
                                                            isSelected && "text-primary-foreground",
                                                            dayIsToday && !isSelected && "text-primary"
                                                        )}>
                                                            {format(day, 'd')}
                                                        </span>

                                                        {sessions.length > 0 && (
                                                            <div className="flex gap-0.5 mt-0.5">
                                                                {sessions.slice(0, 3).map((_, idx) => (
                                                                    <div
                                                                        key={idx}
                                                                        className={cn(
                                                                            "w-1 h-1 rounded-full",
                                                                            isSelected ? "bg-white" : "bg-primary"
                                                                        )}
                                                                    />
                                                                ))}
                                                            </div>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        /* Premium Week View - Ultra Compact */
                        <Card className="border-0 shadow-lg backdrop-blur-sm overflow-hidden bg-card/50">
                            <CardContent className="p-2">
                                {/* Navigation Row */}
                                <div className="flex items-center justify-between mb-2">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setSelectedDate(addDays(selectedDate, -7))}
                                        className="h-6 w-6 hover:bg-primary/10 hover:text-primary"
                                    >
                                        <ChevronLeft className="w-3 h-3" />
                                    </Button>
                                    <span className="text-sm font-semibold">Week of {format(weekStart, 'MMM d')}</span>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setSelectedDate(addDays(selectedDate, 7))}
                                        className="h-6 w-6 hover:bg-primary/10 hover:text-primary"
                                    >
                                        <ChevronRight className="w-3 h-3" />
                                    </Button>
                                </div>

                                {/* Week Days - Ultra Compact */}
                                <div className="grid grid-cols-7 gap-1">
                                    {weekDays.map((day) => {
                                        const sessions = getSessionsForDate(day.date);
                                        const dayIsToday = day.isToday;
                                        const isSelected = isSameDay(day.date, selectedDate);

                                        return (
                                            <button
                                                key={day.name}
                                                onClick={() => setSelectedDate(day.date)}
                                                className={cn(
                                                    "relative flex flex-col items-center py-2 px-1 rounded-lg transition-all duration-200",
                                                    isSelected
                                                        ? "bg-primary text-primary-foreground shadow-md ring-1 ring-primary/50"
                                                        : "hover:bg-muted/50",
                                                    dayIsToday && !isSelected && "ring-1 ring-primary/50 bg-primary/5"
                                                )}
                                            >
                                                <span className={cn(
                                                    "text-sm uppercase tracking-wider font-bold mb-1",
                                                    isSelected ? "text-primary-foreground" : "text-muted-foreground"
                                                )}>
                                                    {day.name.substring(0, 3)}
                                                </span>

                                                <span className={cn(
                                                    "text-base font-bold mb-1",
                                                    isSelected && "text-primary-foreground",
                                                    dayIsToday && !isSelected && "text-primary"
                                                )}>
                                                    {format(day.date, 'd')}
                                                </span>

                                                {sessions.length > 0 && (
                                                    <div className="flex gap-0.5">
                                                        {sessions.slice(0, 3).map((_, idx) => (
                                                            <div
                                                                key={idx}
                                                                className={cn(
                                                                    "w-1 h-1 rounded-full",
                                                                    isSelected ? "bg-white" : "bg-primary"
                                                                )}
                                                            />
                                                        ))}
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Daily Tasks */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-bold flex items-center gap-2 animate-fade-in-up delay-500">
                                <div className="p-1.5 bg-primary/10 rounded-lg border border-primary/20">
                                    <CalendarIcon className="w-5 h-5 text-primary" />
                                </div>
                                {isToday(selectedDate) ? "Today's Schedule" : format(selectedDate, 'eeee, MMMM do')}
                            </h3>
                            <Badge variant="outline" className="px-3 py-1 uppercase tracking-wider bg-primary/5 border-primary/20 text-primary animate-fade-in-up delay-550">
                                {todaySessions.length} Sessions
                            </Badge>
                        </div>

                        {todaySessions.length > 0 ? (
                            <div className="space-y-3">
                                {todaySessions.map((session, idx) => {
                                    const subj = getSubjectDisplay(session);
                                    const top = getTopicDisplay(session);
                                    const done = isCompleted(selectedDate, subj, top);

                                    const focusColors = {
                                        high: { border: 'border-l-rose-500', bg: 'bg-rose-50 dark:bg-rose-950/20', text: 'text-rose-600 dark:text-rose-400' },
                                        medium: { border: 'border-l-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/20', text: 'text-amber-600 dark:text-amber-400' },
                                        low: { border: 'border-l-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/20', text: 'text-emerald-600 dark:text-emerald-400' }
                                    };
                                    const colors = focusColors[session.focus_level ?? 'medium'];

                                    return (
                                        <Card
                                            key={`${subj}-${top}-${idx}`}
                                            className={cn(
                                                "group relative overflow-hidden transition-all duration-500 border-l-[3px] backdrop-blur-sm",
                                                colors.border,
                                                done ? "opacity-50 hover:opacity-70" : "hover:scale-[1.02] hover:shadow-xl",
                                                "animate-fade-in-up delay-600"
                                            )}
                                            style={{ animationDelay: `${600 + idx * 50}ms` }}
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                            <CardContent className="p-5 relative">
                                                <div className="flex items-start gap-4">
                                                    <button
                                                        onClick={() => toggleSession(selectedDate, session)}
                                                        className="shrink-0 mt-0.5 transition-all duration-300 hover:scale-110 active:scale-95"
                                                    >
                                                        {done ? (
                                                            <CheckCircle2 className="w-7 h-7 text-emerald-500 drop-shadow-sm" />
                                                        ) : (
                                                            <Circle className="w-7 h-7 text-muted-foreground hover:text-primary transition-colors duration-200" />
                                                        )}
                                                    </button>

                                                    <div className="flex-1 min-w-0 space-y-2">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="flex-1 min-w-0">
                                                                <h4 className={cn(
                                                                    "font-semibold text-lg leading-tight mb-1 transition-colors duration-200",
                                                                    done && "line-through text-muted-foreground"
                                                                )}>
                                                                    {subj}
                                                                </h4>
                                                                {(() => {
                                                                    const examInfo = getExamInfo(subj);
                                                                    if (examInfo.isNear) {
                                                                        return (
                                                                            <div className="flex items-center gap-1.5 text-sm font-medium">
                                                                                <Badge variant="destructive" className="animate-pulse">
                                                                                    <Target className="w-3 h-3 mr-1" />
                                                                                    Exam in {examInfo.daysUntil} days
                                                                                </Badge>
                                                                            </div>
                                                                        );
                                                                    }
                                                                    return null;
                                                                })()}
                                                                {session.focus_level === 'high' && (
                                                                    <div className="flex items-center gap-1.5 text-sm text-rose-600 dark:text-rose-400 font-medium animate-pulse">
                                                                        <Sparkles className="w-3.5 h-3.5" />
                                                                        <span>Deep Focus Required</span>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className="flex items-center gap-2 text-base font-medium text-muted-foreground shrink-0 bg-muted/50 px-2 py-1 rounded-lg border border-border/30">
                                                                <Clock className="w-4 h-4" />
                                                                <span>{formatDuration(session.duration_minutes)}</span>
                                                            </div>
                                                        </div>

                                                        {top && (
                                                            <p className="text-base text-muted-foreground leading-relaxed line-clamp-2">
                                                                {top}
                                                            </p>
                                                        )}

                                                        {session.key_topics && session.key_topics.length > 0 && (
                                                            <div className="pt-3 border-t border-border/40">
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                                                                    <span className="text-base font-semibold text-foreground">Key Topics</span>
                                                                </div>
                                                                <div className="flex flex-wrap gap-1.5">
                                                                    {session.key_topics.map((topic, topicIdx) => (
                                                                        <span
                                                                            key={`${subj}-topic-${topicIdx}`}
                                                                            className="inline-flex items-center px-2.5 py-1 rounded-full text-base font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors duration-200"
                                                                        >
                                                                            {topic}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {session.resources && session.resources.length > 0 && (
                                                            <div className="pt-3 border-t border-border/40">
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <BookOpen className="w-3.5 h-3.5 text-primary" />
                                                                    <span className="text-base font-semibold text-foreground">Resources</span>
                                                                </div>
                                                                <div className="space-y-1.5">
                                                                    {session.resources.map((resource, resourceIdx) => (
                                                                        <a
                                                                            key={`${subj}-res-${resourceIdx}`}
                                                                            href={resource.url}
                                                                            target="_blank"
                                                                            rel="noreferrer"
                                                                            className="flex items-center gap-2 text-base text-primary hover:text-primary/80 hover:underline transition-all duration-200 hover:translate-x-1"
                                                                        >
                                                                            <Link2 className="w-3.5 h-3.5 shrink-0" />
                                                                            <span className="truncate">{resource.title}</span>
                                                                        </a>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-16 px-4 animate-fade-in-up delay-600">
                                <div className="relative inline-flex items-center justify-center w-24 h-24 mb-6">
                                    <div className="absolute inset-0 bg-gradient-to-br from-violet-500/20 to-purple-500/20 rounded-full animate-pulse"></div>
                                    <div className="relative w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg shadow-violet-500/25 animate-float">
                                        <Sparkles className="w-8 h-8 text-white" />
                                    </div>
                                </div>
                                <h4 className="text-xl font-bold text-foreground mb-2">All Caught Up!</h4>
                                <p className="text-muted-foreground max-w-sm mx-auto">You've completed all your sessions for today. Take a well-deserved break or review your progress!</p>
                            </div>
                        )}
                    </div>

                    {/* Sidebar / Strategy */}
                    <div className="space-y-6">
                        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-violet-600/10 via-purple-600/5 to-background backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-150 animate-fade-in-up delay-650">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-violet-500/10 to-transparent rounded-full blur-3xl animate-pulse-slow"></div>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm uppercase tracking-wider text-violet-600 dark:text-violet-400 flex items-center gap-2">
                                    <div className="p-1.5 bg-violet-500/10 rounded-lg border border-violet-500/20">
                                        <Sparkles className="w-4 h-4" />
                                    </div>
                                    Neuron AI Strategy
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm leading-relaxed text-muted-foreground">
                                    {plan?.generated_plan?.strategy_summary || 'Your personalized study strategy is being optimized by Neuron AI based on your learning patterns and goals...'}
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="border-0 shadow-lg shadow-black/5 backdrop-blur-sm hover:shadow-xl transition-all duration-150 animate-fade-in-up delay-700">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-bold flex items-center gap-2">
                                    <div className="p-1.5 bg-primary/10 rounded-lg border border-primary/20">
                                        <Target className="w-4 h-4 text-primary" />
                                    </div>
                                    Your Goal
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="relative p-4 bg-muted/50 dark:bg-muted/30 rounded-xl border border-border/50 hover:bg-muted/60 transition-colors duration-200">
                                    <div className="absolute top-2 right-2">
                                        <Badge variant="outline" className="text-sm uppercase bg-background/80 backdrop-blur-sm">
                                            {plan.status}
                                        </Badge>
                                    </div>
                                    <p className="text-sm italic text-foreground pr-16">"{plan.goal}"</p>
                                </div>

                                <div className="flex items-center justify-between text-sm text-muted-foreground pt-2 border-t border-border/40">
                                    <span>Study Duration</span>
                                    <span className="font-medium text-foreground">{format(parseISO(plan.starts_on), 'MMM d, yyyy')} - {format(parseISO(plan.ends_on), 'MMM d, yyyy')}</span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>

        </AppLayout>
    );
}

// Helper to mock the route function since we might not have Ziggy globally typed here
function route(name: string) {
    if (name === 'study-plan.toggle-session') return '/study-plan/toggle-session';
    if (name === 'study-plan.rebalance') return '/study-plan/rebalance';
    if (name === 'study-plan.update-goals') return '/study-plan/update-goals';
    return '';
}
