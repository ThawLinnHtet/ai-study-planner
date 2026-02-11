import { Head } from '@inertiajs/react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { Award, CheckCircle2, Flame, Sparkles, SpellCheck, Target, Timer, TrendingUp, XCircle, ChevronDown, ChevronUp, BookOpen, RotateCcw, Eye } from 'lucide-react';
import { useState, useEffect } from 'react';
import Heading from '@/components/heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import AppLayout from '@/layouts/app-layout';
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

// Add custom styles for animations
const customStyles = `
@keyframes slideDown {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
}

.animate-slide-down {
    animation: slideDown 0.3s ease-out;
}
`;

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Progress',
        href: '/progress',
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

type QuizHistoryItem = {
    id: number;
    subject: string;
    topic: string;
    percentage: number;
    passed: boolean;
    correct_count: number;
    incorrect_count: number;
    skipped_count: number;
    total_questions: number;
    taken_at: string | null;
    review?: Array<{
        question: string;
        user_answer: string;
        correct_answer: string;
        is_correct: boolean;
        explanation?: string;
        options?: (string | { label: string; text: string })[];
    }>;
};

type SubjectBreakdown = {
    subject: string;
    total: number;
    passed: number;
    average: number;
};

type QuizStats = {
    total: number;
    passed: number;
    failed: number;
    average_score: number;
    pass_rate: number;
    subject_breakdown: SubjectBreakdown[];
    trends: QuizTrends;
    performance: QuizPerformance;
};

type QuizTrends = {
    score_trend: Array<{
        date: string;
        score: number;
        subject: string;
        topic: string;
    }>;
    completion_trend: Array<{
        date: string;
        completed: number;
        attempted: number;
    }>;
    subject_performance: Array<{
        subject: string;
        average_score: number;
        improvement_rate: number;
        trend: 'up' | 'down' | 'stable';
    }>;
};

type QuizPerformance = {
    best_score: number;
    worst_score: number;
    most_recent_score: number;
    average_last_5: number;
    average_last_10: number;
    improvement_rate: number;
    consistency_score: number;
    weak_areas: Array<{
        subject: string;
        topic: string;
        average_score: number;
        attempts: number;
        improvement_needed: boolean;
    }>;
    strong_areas: Array<{
        subject: string;
        topic: string;
        average_score: number;
        attempts: number;
        mastery_level: string;
    }>;
};

interface Props {
    progress: ProgressStats;
    quizHistory: QuizHistoryItem[];
    quizStats: QuizStats;
    quizTrends?: QuizTrends;
}

function formatMinutes(minutes: number): string {
    const m = Math.max(0, minutes);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r === 0 ? `${h}h` : `${h}h ${r}m`;
}

// Helper function to extract option text
function getOptionText(option: string | { label: string; text: string }): string {
    if (typeof option === 'string') return option;
    return option.text || option.label || '';
}

// Quiz Card Component
function QuizCard({ quiz }: { quiz: QuizHistoryItem }) {
    const [expanded, setExpanded] = useState(false);
    const hasReview = quiz.review && quiz.review.length > 0;

    return (
        <Card className="border bg-card shadow-sm hover:shadow-md transition-all duration-200">
            <CardContent className="p-4">
                {/* Summary Row */}
                <div className="flex items-center gap-3">
                    <div className="shrink-0">
                        {quiz.passed ? (
                            <div className="bg-green-100 text-green-600 rounded-full p-2">
                                <CheckCircle2 className="w-4 h-4" />
                            </div>
                        ) : (
                            <div className="bg-red-100 text-red-600 rounded-full p-2">
                                <XCircle className="w-4 h-4" />
                            </div>
                        )}
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-semibold truncate">
                                {quiz.subject}{quiz.topic ? `: ${quiz.topic}` : ''}
                            </p>
                            <Badge
                                variant={quiz.passed ? 'default' : 'destructive'}
                                className="shrink-0 text-xs"
                            >
                                {quiz.percentage}%
                            </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>{quiz.correct_count}/{quiz.total_questions} correct</span>
                            {quiz.taken_at && (
                                <span>{formatDistanceToNow(parseISO(quiz.taken_at), { addSuffix: true })}</span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpanded(!expanded)}
                            className="h-8 w-8 p-0"
                        >
                            {expanded ? (
                                <ChevronUp className="w-4 h-4" />
                            ) : (
                                <ChevronDown className="w-4 h-4" />
                            )}
                        </Button>
                    </div>
                </div>

                {/* Expanded Details */}
                {expanded && (
                    <div className="mt-4 pt-4 border-t space-y-4 animate-slide-down">
                        {/* Quick Stats */}
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                                <p className="text-lg font-bold text-green-700">{quiz.correct_count}</p>
                                <p className="text-xs text-green-600">Correct</p>
                            </div>
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                                <p className="text-lg font-bold text-red-700">{quiz.incorrect_count}</p>
                                <p className="text-xs text-red-600">Incorrect</p>
                            </div>
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                                <p className="text-lg font-bold text-gray-700">{quiz.skipped_count || 0}</p>
                                <p className="text-xs text-gray-600">Skipped</p>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 text-xs"
                                disabled={!hasReview}
                                onClick={() => {
                                    // Navigate to detailed review (if available)
                                    if (hasReview) {
                                        // TODO: Create this route in backend
                                        console.log('Navigate to review:', quiz.id);
                                        alert('Detailed review feature coming soon!');
                                    }
                                }}
                            >
                                <Eye className="w-3 h-3 mr-1" />
                                {hasReview ? 'Full Review' : 'Review N/A'}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 text-xs"
                                onClick={() => {
                                    // Navigate back to study planner to retake quiz
                                    window.location.href = '/study-planner';
                                }}
                            >
                                <RotateCcw className="w-3 h-3 mr-1" />
                                Back to Study
                            </Button>
                        </div>

                        {/* Question Preview (only if review data available) */}
                        {hasReview && (
                            <div className="space-y-2">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Question Preview</p>
                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                    {quiz.review?.slice(0, 3).map((item, index) => (
                                        <div
                                            key={index}
                                            className={cn(
                                                "p-2 rounded-lg border text-xs",
                                                item.is_correct
                                                    ? "bg-green-50 border-green-200"
                                                    : "bg-red-50 border-red-200"
                                            )}
                                        >
                                            <div className="flex items-start gap-2">
                                                <span className="shrink-0 w-4 h-4 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">
                                                    {index + 1}
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium truncate">{item.question}</p>
                                                    <div className="mt-1 flex items-center gap-2">
                                                        <span className="text-muted-foreground">Your: {item.user_answer}</span>
                                                        {!item.is_correct && (
                                                            <>
                                                                <span className="text-muted-foreground">→</span>
                                                                <span className="text-green-600">Correct: {item.correct_answer}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                {item.is_correct ? (
                                                    <CheckCircle2 className="w-3 h-3 text-green-600 shrink-0" />
                                                ) : (
                                                    <XCircle className="w-3 h-3 text-red-600 shrink-0" />
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {quiz.review && quiz.review.length > 3 && (
                                        <p className="text-xs text-muted-foreground text-center py-2">
                                            ... and {quiz.review.length - 3} more questions
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Performance Message */}
                        <div className={cn(
                            "p-3 rounded-lg text-xs",
                            quiz.passed
                                ? "bg-green-50 border border-green-200 text-green-700"
                                : "bg-orange-50 border border-orange-200 text-orange-700"
                        )}>
                            {quiz.passed ? (
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span className="font-medium">Excellent work! You've mastered this topic.</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <Target className="w-3 h-3" />
                                    <span className="font-medium">Keep practicing! Review the incorrect answers to improve.</span>
                                </div>
                            )}
                        </div>

                        {/* No Review Data Message */}
                        {!hasReview && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                                <div className="flex items-center gap-2">
                                    <Eye className="w-3 h-3" />
                                    <div>
                                        <span className="font-medium">Detailed review data not available</span>
                                        <p className="text-blue-600 mt-1">Future quizzes will save detailed answers for review.</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default function ProgressPage({ progress: stats, quizHistory, quizStats, quizTrends }: Props) {
    const xpToNext = Math.max(0, stats.xp.next_level_at - stats.xp.total);

    // Inject custom styles
    useEffect(() => {
        const styleElement = document.createElement('style');
        styleElement.textContent = customStyles;
        document.head.appendChild(styleElement);

        return () => {
            document.head.removeChild(styleElement);
        };
    }, []);

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
                                <ResponsiveContainer width="100%" height={220}>
                                    <AreaChart data={stats.series} margin={{ left: 8, right: 8, top: 10, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="xpFill" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                                                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                                        <XAxis
                                            dataKey="date"
                                            tick={{ fontSize: 11 }}
                                            tickLine={false}
                                            axisLine={false}
                                        />
                                        <YAxis
                                            tick={{ fontSize: 11 }}
                                            tickLine={false}
                                            axisLine={false}
                                            tickFormatter={(value) => `${value}`}
                                        />
                                        <RechartsTooltip
                                            content={({ active, payload }) => {
                                                if (active && payload?.length) {
                                                    const data = payload[0].payload;
                                                    return (
                                                        <div className="bg-background border rounded-lg p-2 shadow-lg">
                                                            <p className="text-sm font-medium">{format(parseISO(data.date), 'MMM d')}</p>
                                                            <p className="text-sm text-muted-foreground">{data.xp} XP</p>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
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
                                <ResponsiveContainer width="100%" height={180}>
                                    <BarChart data={stats.series} margin={{ left: 8, right: 8, top: 10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                                        <XAxis
                                            dataKey="date"
                                            tick={{ fontSize: 11 }}
                                            tickLine={false}
                                            axisLine={false}
                                        />
                                        <YAxis
                                            tick={{ fontSize: 11 }}
                                            tickLine={false}
                                            axisLine={false}
                                            tickFormatter={(value) => `${value}`}
                                        />
                                        <RechartsTooltip
                                            content={({ active, payload }) => {
                                                if (active && payload?.length) {
                                                    const data = payload[0].payload;
                                                    return (
                                                        <div className="bg-background border rounded-lg p-2 shadow-lg">
                                                            <p className="text-sm font-medium">{format(parseISO(data.date), 'MMM d')}</p>
                                                            <p className="text-sm text-muted-foreground">{formatMinutes(data.minutes)}</p>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
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

                {/* Quiz Performance Section */}
                <div className="space-y-6">
                    <Heading
                        title="Quiz Performance"
                        description="Your quiz results, scores, and subject mastery"
                    />

                    {/* Quiz Stats Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Quizzes</p>
                                        <p className="text-2xl font-black mt-1">{quizStats.total}</p>
                                    </div>
                                    <SpellCheck className="w-5 h-5 text-primary" />
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Pass Rate</p>
                                        <p className="text-2xl font-black mt-1">{quizStats.pass_rate}%</p>
                                    </div>
                                    <TrendingUp className="w-5 h-5 text-green-500" />
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Avg Score</p>
                                        <p className="text-2xl font-black mt-1">{quizStats.average_score}%</p>
                                    </div>
                                    <Target className="w-5 h-5 text-blue-500" />
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Passed</p>
                                        <p className="text-2xl font-black mt-1">
                                            <span className="text-green-600">{quizStats.passed}</span>
                                            <span className="text-muted-foreground text-sm font-normal"> / {quizStats.total}</span>
                                        </p>
                                    </div>
                                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Quiz Performance Trends */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Score Trend Chart */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5 text-primary" />
                                    Score Trends
                                </CardTitle>
                                <CardDescription>Your quiz scores over time</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {quizTrends?.score_trend && quizTrends.score_trend.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={200}>
                                        <AreaChart data={quizTrends.score_trend}>
                                            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                                            <XAxis
                                                dataKey="date"
                                                tick={{ fontSize: 12 }}
                                                tickFormatter={(value) => format(parseISO(value), 'MMM d')}
                                            />
                                            <YAxis
                                                tick={{ fontSize: 12 }}
                                                domain={[0, 100]}
                                            />
                                            <RechartsTooltip
                                                formatter={(value: any) => [`${value}%`, 'Score']}
                                                labelFormatter={(value) => format(parseISO(value as string), 'MMM d, yyyy')}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="score"
                                                stroke="hsl(var(--primary))"
                                                fill="hsl(var(--primary))"
                                                fillOpacity={0.3}
                                                strokeWidth={2}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                                        <div className="text-center">
                                            <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                            <p className="text-sm">No quiz data available yet</p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Subject Performance */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="flex items-center gap-2">
                                    <Target className="w-5 h-5 text-primary" />
                                    Subject Performance
                                </CardTitle>
                                <CardDescription>Average scores by subject</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {quizStats?.subject_breakdown && quizStats.subject_breakdown.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={200}>
                                        <BarChart data={quizStats.subject_breakdown}>
                                            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                                            <XAxis
                                                dataKey="subject"
                                                tick={{ fontSize: 12 }}
                                                angle={-45}
                                                textAnchor="end"
                                                height={60}
                                            />
                                            <YAxis
                                                tick={{ fontSize: 12 }}
                                                domain={[0, 100]}
                                            />
                                            <RechartsTooltip
                                                formatter={(value: any) => [`${value}%`, 'Average Score']}
                                            />
                                            <Bar
                                                dataKey="average"
                                                fill="hsl(var(--primary))"
                                                radius={[4, 4, 0, 0]}
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                                        <div className="text-center">
                                            <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                            <p className="text-sm">No subject data available yet</p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Performance Insights */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Recent Performance */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="flex items-center gap-2">
                                    <Flame className="w-5 h-5 text-orange-500" />
                                    Recent Performance
                                </CardTitle>
                                <CardDescription>Last 10 quizzes average</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">Last 5 Quizzes</span>
                                        <span className="font-semibold">
                                            {quizHistory.length >= 5
                                                ? `${Math.round(quizHistory.slice(0, 5).reduce((sum, q) => sum + q.percentage, 0) / 5)}%`
                                                : 'N/A'
                                            }
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">Last 10 Quizzes</span>
                                        <span className="font-semibold">
                                            {quizHistory.length >= 10
                                                ? `${Math.round(quizHistory.slice(0, 10).reduce((sum, q) => sum + q.percentage, 0) / 10)}%`
                                                : quizHistory.length > 0
                                                    ? `${Math.round(quizHistory.reduce((sum, q) => sum + q.percentage, 0) / quizHistory.length)}%`
                                                    : 'N/A'
                                            }
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">Best Score</span>
                                        <span className="font-semibold text-green-600">
                                            {quizHistory.length > 0
                                                ? `${Math.max(...quizHistory.map(q => q.percentage))}%`
                                                : 'N/A'
                                            }
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">Most Recent</span>
                                        <span className="font-semibold">
                                            {quizHistory.length > 0
                                                ? `${quizHistory[0].percentage}%`
                                                : 'N/A'
                                            }
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Improvement Areas */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="flex items-center gap-2">
                                    <Award className="w-5 h-5 text-yellow-500" />
                                    Strongest Areas
                                </CardTitle>
                                <CardDescription>Topics you excel at</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {quizStats?.subject_breakdown && quizStats.subject_breakdown.length > 0 ? (
                                        quizStats.subject_breakdown
                                            .sort((a, b) => b.average - a.average)
                                            .slice(0, 3)
                                            .map((subject, index) => (
                                                <div key={subject.subject} className="flex items-center justify-between">
                                                    <span className="text-sm font-medium">{subject.subject}</span>
                                                    <div className="flex items-center gap-2">
                                                        <Progress value={subject.average} className="w-16 h-2" />
                                                        <span className="text-sm font-semibold">{Math.round(subject.average)}%</span>
                                                    </div>
                                                </div>
                                            ))
                                    ) : (
                                        <p className="text-sm text-muted-foreground text-center py-4">
                                            Complete more quizzes to see your strongest areas
                                        </p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Completion Rate */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="flex items-center gap-2">
                                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                                    Completion Stats
                                </CardTitle>
                                <CardDescription>Quiz completion rates</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">Pass Rate</span>
                                        <span className="font-semibold text-green-600">{quizStats.pass_rate}%</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">Total Passed</span>
                                        <span className="font-semibold">{quizStats.passed}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">Total Failed</span>
                                        <span className="font-semibold text-red-600">{quizStats.failed}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">Average Score</span>
                                        <span className="font-semibold">{Math.round(quizStats.average_score)}%</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Subject Mastery */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="flex items-center gap-2">
                                    <Target className="w-5 h-5 text-primary" />
                                    Subject Mastery
                                </CardTitle>
                                <CardDescription>Performance breakdown by subject</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {quizStats.subject_breakdown.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-4">
                                        No quizzes taken yet. Practice from the Study Planner to see your mastery here.
                                    </p>
                                ) : (
                                    quizStats.subject_breakdown.map((s) => (
                                        <div key={s.subject} className="space-y-2">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="font-medium truncate">{s.subject || 'Unknown'}</span>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span className="text-muted-foreground text-xs">{s.passed}/{s.total} passed</span>
                                                    <Badge variant={s.average >= 80 ? 'default' : 'secondary'} className="text-xs">
                                                        {s.average}%
                                                    </Badge>
                                                </div>
                                            </div>
                                            <Progress value={s.average} className="h-2" />
                                        </div>
                                    ))
                                )}
                            </CardContent>
                        </Card>

                        {/* Enhanced Recent Quiz History */}
                        <Card className="lg:col-span-2">
                            <CardHeader className="pb-2">
                                <CardTitle className="flex items-center gap-2">
                                    <SpellCheck className="w-5 h-5 text-primary" />
                                    Recent Quizzes
                                </CardTitle>
                                <CardDescription>Your latest quiz attempts with detailed review options</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {quizHistory.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-8">
                                        No quizzes taken yet. Go to the Study Planner and click "Take Quiz" on any session to get started!
                                    </p>
                                ) : (
                                    <div className="space-y-3 max-h-[500px] overflow-y-auto">
                                        {quizHistory.map((quiz) => (
                                            <QuizCard key={quiz.id} quiz={quiz} />
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
