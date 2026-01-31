import Heading from '@/components/heading';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import {
    CheckCircle2,
    Circle,
    Clock,
    Calendar as CalendarIcon,
    Zap,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    AlertCircle
} from 'lucide-react';
import { useState, useMemo } from 'react';
import {
    format,
    startOfWeek,
    addDays,
    isSameDay,
    isToday,
    parseISO,
    startOfDay
} from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Session {
    subject: string;
    topic: string;
    duration_minutes: number;
    focus_level: 'low' | 'medium' | 'high';
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
}

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Study Planner',
        href: '/study-planner',
    },
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function StudyPlanner({ plan, completedSessions }: Props) {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });

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
            subject: session.subject,
            topic: session.topic,
            duration_minutes: session.duration_minutes,
            started_at: format(date, "yyyy-MM-dd HH:mm:ss"),
            status: completed ? 'pending' : 'completed'
        });

        form.post(route('study-plan.toggle-session'), {
            preserveScroll: true
        });
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
    const rawSchedule = plan.generated_plan.schedule || (plan.generated_plan as any).optimized_schedule || {};

    // Check if the selected date is within the plan's life span
    const planStart = startOfDay(parseISO(plan.starts_on));
    const planEnd = startOfDay(parseISO(plan.ends_on));
    const targetDate = startOfDay(selectedDate);
    const isWithinRange = targetDate >= planStart && targetDate <= planEnd;

    // 1. Find the day object (handle both numeric indices and direct day names)
    let dayData: any = isWithinRange ? (rawSchedule[currentDayName] || Object.values(rawSchedule).find((v: any) => v[currentDayName])) : null;

    // 2. If it was nested like [0] => { "Monday": ... }, unwrap it
    if (dayData && dayData[currentDayName]) dayData = dayData[currentDayName];

    // 3. Extract sessions and handle raw strings if AI ignored the object structure
    const rawSessions = dayData?.sessions || (Array.isArray(dayData) ? dayData : []);
    const todaySessions: Session[] = rawSessions.map((s: any) => {
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

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Study Planner" />

            <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <Heading
                        title="Study Planner"
                        description={plan.title}
                    />
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleRebalance}
                            disabled={rebalanceForm.processing}
                        >
                            <RefreshCw className={cn("w-4 h-4 mr-2", rebalanceForm.processing && "animate-spin")} />
                            Re-balance with AI
                        </Button>
                    </div>
                </div>

                {/* Week Navigation */}
                <div className="flex items-center justify-between bg-card border rounded-xl p-2 shadow-sm">
                    <Button variant="ghost" size="icon" onClick={() => setSelectedDate(addDays(selectedDate, -7))}>
                        <ChevronLeft className="w-5 h-5" />
                    </Button>

                    <div className="flex-1 grid grid-cols-7 gap-1 px-2">
                        {weekDays.map((day) => (
                            <button
                                key={day.name}
                                onClick={() => setSelectedDate(day.date)}
                                className={cn(
                                    "flex flex-col items-center py-2 rounded-lg transition-all",
                                    isSameDay(day.date, selectedDate)
                                        ? "bg-primary text-primary-foreground shadow-md"
                                        : "hover:bg-muted",
                                    day.isToday && !isSameDay(day.date, selectedDate) && "text-primary font-bold"
                                )}
                            >
                                <span className="text-[10px] uppercase tracking-wider opacity-80">{day.name.substring(0, 3)}</span>
                                <span className="text-lg font-semibold">{format(day.date, 'd')}</span>
                                {day.isToday && <div className={cn("w-1 h-1 rounded-full mt-1", isSameDay(day.date, selectedDate) ? "bg-white" : "bg-primary")} />}
                            </button>
                        ))}
                    </div>

                    <Button variant="ghost" size="icon" onClick={() => setSelectedDate(addDays(selectedDate, 7))}>
                        <ChevronRight className="w-5 h-5" />
                    </Button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Daily Tasks */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <CalendarIcon className="w-5 h-5 text-primary" />
                                {isToday(selectedDate) ? "Today's Schedule" : format(selectedDate, 'eeee, MMMM do')}
                            </h3>
                            <Badge variant="outline" className="px-3 py-1 uppercase tracking-wider">
                                {todaySessions.length} Sessions
                            </Badge>
                        </div>

                        {todaySessions.length > 0 ? (
                            <div className="space-y-4">
                                {todaySessions.map((session, idx) => {
                                    const done = isCompleted(selectedDate, session.subject, session.topic);
                                    return (
                                        <Card
                                            key={`${session.subject}-${session.topic}-${idx}`}
                                            className={cn(
                                                "transition-all border-l-4 overflow-hidden",
                                                session.focus_level === 'high' ? "border-l-destructive" :
                                                    session.focus_level === 'medium' ? "border-l-amber-500" : "border-l-emerald-500",
                                                done && "opacity-60 bg-muted/50 border-l-muted"
                                            )}
                                        >
                                            <CardContent className="p-0">
                                                <div className="flex items-center p-4 gap-4">
                                                    <button
                                                        onClick={() => toggleSession(selectedDate, session)}
                                                        className="flex-shrink-0 transition-transform hover:scale-110"
                                                    >
                                                        {done ? (
                                                            <CheckCircle2 className="w-8 h-8 text-emerald-500 fill-emerald-100" />
                                                        ) : (
                                                            <Circle className="w-8 h-8 text-muted-foreground" />
                                                        )}
                                                    </button>

                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <h4 className={cn("font-bold text-lg truncate", done && "line-through")}>
                                                                {session.subject}
                                                            </h4>
                                                            <Badge variant="secondary" className="text-[10px] h-5">
                                                                {session.focus_level.toUpperCase()}
                                                            </Badge>
                                                        </div>
                                                        <p className="text-muted-foreground text-sm line-clamp-1 italic">
                                                            {session.topic}
                                                        </p>
                                                    </div>

                                                    <div className="flex flex-col items-end gap-1">
                                                        <div className="flex items-center text-sm font-medium text-muted-foreground">
                                                            <Clock className="w-3 h-3 mr-1" />
                                                            {session.duration_minutes}m
                                                        </div>
                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <div className="p-1">
                                                                        <Zap className={cn(
                                                                            "w-4 h-4",
                                                                            session.focus_level === 'high' ? "text-destructive" :
                                                                                session.focus_level === 'medium' ? "text-amber-500" : "text-emerald-500"
                                                                        )} />
                                                                    </div>
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                    {session.focus_level === 'high' ? "High focus required" : "Moderate pace"}
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        ) : (
                            <Card className="border-dashed py-12">
                                <CardContent className="flex flex-col items-center justify-center text-center">
                                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                                        <Clock className="w-6 h-6 text-muted-foreground" />
                                    </div>
                                    <h4 className="font-medium text-muted-foreground">No sessions scheduled</h4>
                                    <p className="text-sm text-muted-foreground mt-1">Take a break or review your goals!</p>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* Sidebar / Strategy */}
                    <div className="space-y-6">
                        <Card className="bg-primary/5 border-primary/20">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm uppercase tracking-wider text-primary flex items-center gap-2">
                                    <Zap className="w-4 h-4" />
                                    Neuron Logic
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm leading-relaxed text-muted-foreground">
                                    {plan?.generated_plan?.strategy_summary || 'Your study strategy is being calculated by Neuron AI...'}
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-bold">Goal Context</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="p-3 bg-muted rounded-lg text-sm italic">
                                    "{plan.goal}"
                                </div>
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>Plan Status:</span>
                                    <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-200 bg-emerald-50 uppercase">
                                        {plan.status}
                                    </Badge>
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
    return '';
}
