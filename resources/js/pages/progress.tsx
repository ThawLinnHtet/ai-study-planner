import { Head } from '@inertiajs/react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { Award, CheckCircle2, Flame, Sparkles, SpellCheck, Target, Timer, TrendingUp, XCircle, ChevronDown, ChevronUp, BookOpen, RotateCcw, Eye } from 'lucide-react';
import { StreakIcon, getStreakMessage, getStreakColor } from '@/components/streak-icon';
import { useState, useEffect } from 'react';
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
import Heading from '@/components/heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import type { BreadcrumbItem } from '@/types';

// Quiz Review Modal Component
function QuizReviewModal({ quiz, isOpen, onClose }: { quiz: QuizHistoryItem; isOpen: boolean; onClose: () => void }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-background border rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
                {/* Modal Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <div>
                        <h2 className="text-xl font-semibold">Quiz Review</h2>
                        <p className="text-sm text-muted-foreground">
                            {quiz.subject}{quiz.topic ? `: ${quiz.topic}` : ''} • {quiz.percentage}% score
                        </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={onClose}>
                        <XCircle className="w-4 h-4" />
                    </Button>
                </div>

                {/* Modal Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                    <div className="space-y-4">
                        {quiz.review?.map((item, index) => (
                            <div
                                key={index}
                                className={cn(
                                    "p-4 rounded-lg border",
                                    item.is_correct
                                        ? "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800"
                                        : "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800"
                                )}
                            >
                                <div className="flex items-start gap-4">
                                    <span className={cn(
                                        "shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold",
                                        item.is_correct
                                            ? "bg-green-200 text-green-700"
                                            : "bg-red-200 text-red-700"
                                    )}>
                                        {index + 1}
                                    </span>
                                    <div className="flex-1 space-y-3">
                                        <div>
                                            <p className="font-medium text-base">{item.question}</p>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex items-center gap-3 text-sm">
                                                <span className="text-muted-foreground font-medium">Your answer:</span>
                                                <span className={cn(
                                                    "font-medium",
                                                    item.is_correct ? "text-green-600" : "text-red-600"
                                                )}>
                                                    {item.user_answer || 'Not answered'}
                                                </span>
                                            </div>
                                            {!item.is_correct && (
                                                <div className="flex items-center gap-3 text-sm">
                                                    <span className="text-muted-foreground font-medium">Correct answer:</span>
                                                    <span className="text-green-600 font-medium">{item.correct_answer}</span>
                                                </div>
                                            )}

                                            {/* Show all answer options like a real quiz */}
                                            {item.options && item.options.length > 0 && (
                                                <div className="mt-3 space-y-2">
                                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Answer Options:</p>
                                                    <div className="space-y-1">
                                                        {item.options.map((option: string | { label: string; text: string }, optIndex: number) => {
                                                            const optionLetter = String.fromCharCode(65 + optIndex); // A, B, C, D
                                                            const optionText = typeof option === 'string' ? option : option.text || option.label;
                                                            const isUserAnswer = item.user_answer === optionText;
                                                            const isCorrectAnswer = item.correct_answer === optionText;

                                                            return (
                                                                <div
                                                                    key={optIndex}
                                                                    className={cn(
                                                                        "flex items-center gap-2 p-2 rounded text-sm border",
                                                                        isUserAnswer && isCorrectAnswer
                                                                            ? "bg-green-100 border-green-300 text-green-800"
                                                                            : isUserAnswer && !isCorrectAnswer
                                                                                ? "bg-red-100 border-red-300 text-red-800"
                                                                                : isCorrectAnswer
                                                                                    ? "bg-green-50 border-green-200 text-green-700"
                                                                                    : "bg-muted/30 border-border"
                                                                    )}
                                                                >
                                                                    <span className="font-medium">{optionLetter}.</span>
                                                                    <span className="flex-1">{optionText}</span>
                                                                    {isUserAnswer && isCorrectAnswer && (
                                                                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                                                                    )}
                                                                    {isUserAnswer && !isCorrectAnswer && (
                                                                        <XCircle className="w-4 h-4 text-red-600" />
                                                                    )}
                                                                    {isCorrectAnswer && !isUserAnswer && (
                                                                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {item.explanation && (
                                                <div className="text-sm text-muted-foreground italic p-3 bg-muted/30 rounded-lg border-l-4 border-primary">
                                                    💡 <strong>Explanation:</strong> {item.explanation}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {item.is_correct ? (
                                        <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                                    ) : (
                                        <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-between p-6 border-t bg-muted/30">
                    <div className="text-sm text-muted-foreground">
                        {quiz.correct_count} correct • {quiz.incorrect_count} incorrect • {quiz.skipped_count || 0} skipped
                    </div>
                    <Button onClick={onClose}>Close Review</Button>
                </div>
            </div>
        </div>
    );
}

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
            xp: number;
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
        xp_reward: number;
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

// Helper function to format streak text grammatically
function formatStreak(days: number): string {
    if (days === 0) return 'No streak yet';
    if (days === 1) return '1 day streak';
    return `${days} day streak`;
}

// Helper function to extract option text
function getOptionText(option: string | { label: string; text: string }): string {
    if (typeof option === 'string') return option;
    return option.text || option.label || '';
}

// Quiz Card Component
function QuizCard({ quiz }: { quiz: QuizHistoryItem }) {
    const [showReviewModal, setShowReviewModal] = useState(false);
    const hasReview = quiz.review && quiz.review.length > 0;

    return (
        <>
            <Card className="border bg-card shadow-sm hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 group overflow-hidden active-press border-2 hover:border-primary/20">
                <CardContent className="p-5 relative z-10">
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
                                <p className="text-lg font-black truncate group-hover:translate-x-1 transition-transform">
                                    {quiz.subject}{quiz.topic ? `: ${quiz.topic}` : ''}
                                </p>
                                <Badge
                                    variant={quiz.passed ? 'default' : 'destructive'}
                                    className="shrink-0 text-xs font-bold"
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
                    </div>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-3 gap-3 mt-4">
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
                    <div className="flex gap-2 mt-4">
                        <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 text-xs"
                            disabled={!hasReview}
                            onClick={() => setShowReviewModal(true)}
                        >
                            <Eye className="w-3 h-3 mr-1" />
                            {hasReview ? 'View Review' : 'Review N/A'}
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

                    {/* Performance Message */}
                    <div className={cn(
                        "p-3 rounded-lg text-xs mt-4",
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
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700 mt-4">
                            <div className="flex items-center gap-2">
                                <Eye className="w-3 h-3" />
                                <div>
                                    <span className="font-medium">Detailed review data not available</span>
                                    <p className="text-blue-600 mt-1">Future quizzes will save detailed answers for review.</p>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Review Modal */}
            <QuizReviewModal
                quiz={quiz}
                isOpen={showReviewModal}
                onClose={() => setShowReviewModal(false)}
            />
        </>
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
                <div className="animate-fade-in">
                    <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-slate-50">Progress</h1>
                    <p className="text-muted-foreground mt-2 text-lg">Your streak, XP, achievements, and weekly progress</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background">
                        <CardHeader className="pb-2">
                            <CardDescription className="font-bold uppercase tracking-wider text-[10px]">Level</CardDescription>
                            <CardTitle className="flex items-end justify-between gap-3">
                                <div>
                                    <span className="text-4xl font-black tracking-tight">{stats.xp.level}</span>
                                    <div className="text-xs text-muted-foreground font-bold uppercase tracking-tight mt-1">
                                        {stats.xp.total.toLocaleString()} / {stats.xp.next_level_at.toLocaleString()} XP
                                    </div>
                                </div>
                                <Badge variant="secondary" className="gap-1 font-bold">
                                    <Sparkles className="w-3 h-3 text-amber-500" />
                                    Level {stats.xp.level}
                                </Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="space-y-2">
                                <div className="shimmer-wrapper rounded-full">
                                    <Progress value={stats.xp.progress_percent} className={cn("h-3", stats.xp.progress_percent > 0 && "shimmer-active")} />
                                </div>
                                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-tight">
                                    <span className="text-muted-foreground">
                                        {stats.xp.into_level.toLocaleString()} earned
                                    </span>
                                    <span className="text-amber-600">
                                        +{xpToNext.toLocaleString()} to next
                                    </span>
                                </div>
                            </div>

                            {/* XP Milestones */}
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="rounded-lg border bg-muted/30 p-2 group-hover:bg-muted/50 transition-colors">
                                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Today</div>
                                    <div className="text-sm font-black text-green-600">
                                        +{stats.sessions.today.xp || 0}
                                    </div>
                                </div>
                                <div className="rounded-lg border bg-muted/30 p-2 group-hover:bg-muted/50 transition-colors">
                                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Week</div>
                                    <div className="text-sm font-black text-blue-600">
                                        +{stats.sessions.week.xp || 0}
                                    </div>
                                </div>
                                <div className="rounded-lg border bg-muted/30 p-2 group-hover:bg-muted/50 transition-colors">
                                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Total</div>
                                    <div className="text-sm font-black text-purple-600">
                                        {stats.xp.total.toLocaleString()}
                                    </div>
                                </div>
                            </div>

                            <p className="text-xs text-muted-foreground italic leading-relaxed">{stats.insight}</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Streak</CardDescription>
                            <CardTitle className="flex items-center justify-between">
                                <span className={cn('text-3xl font-black tracking-tight', getStreakColor(stats.streak.current))}>
                                    {formatStreak(stats.streak.current)}
                                </span>
                                <StreakIcon streak={stats.streak.current} size="lg" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 gap-3">
                            <div className="rounded-lg border bg-muted/30 p-3">
                                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Best</div>
                                <div className="mt-1 flex items-center gap-2">
                                    <StreakIcon streak={stats.streak.best} size="sm" />
                                    <span className={cn('text-lg font-bold', getStreakColor(stats.streak.best))}>
                                        {formatStreak(stats.streak.best)}
                                    </span>
                                </div>
                            </div>
                            <div className="rounded-lg border bg-muted/30 p-3">
                                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Today</div>
                                <div className="mt-1 text-lg font-bold">{formatMinutes(stats.sessions.today.minutes)}</div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="relative overflow-hidden group hover:border-primary/20 transition-colors border-2 border-transparent">
                        <CardHeader className="pb-2">
                            <CardDescription className="font-bold uppercase tracking-wider text-[10px]">Weekly Goal</CardDescription>
                            <CardTitle className="flex items-center justify-between">
                                <span className="text-4xl font-black tracking-tight tabular-nums">
                                    {stats.sessions.week.target_percent == null ? '—' : `${stats.sessions.week.target_percent}%`}
                                </span>
                                <Target className="w-6 h-6 text-primary group-hover:scale-110 transition-transform" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="shimmer-wrapper rounded-full">
                                <Progress value={stats.sessions.week.target_percent ?? 0} className={cn("h-2.5", (stats.sessions.week.target_percent ?? 0) > 0 && "shimmer-active")} />
                            </div>
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
                </div >

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
                            <div className="h-[250px] w-full min-h-[250px]">
                                <ResponsiveContainer width="100%" height="100%">
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
                                                        <div className="bg-background/90 backdrop-blur-md border-2 border-primary/20 rounded-xl p-3 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                                                            <p className="text-xs font-black uppercase tracking-widest text-primary mb-1">{format(parseISO(data.date), 'EEEE, MMM d')}</p>
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-2 h-2 rounded-full bg-primary" />
                                                                <p className="text-lg font-black tracking-tight">{data.xp} <span className="text-[10px] text-muted-foreground uppercase">XP Earned</span></p>
                                                            </div>
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

                            <div className="h-[180px] w-full min-h-[180px]">
                                <ResponsiveContainer width="100%" height="100%">
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
                                                        <div className="bg-background/90 backdrop-blur-md border-2 border-primary/20 rounded-xl p-3 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                                                            <p className="text-xs font-black uppercase tracking-widest text-primary mb-1">{format(parseISO(data.date), 'EEEE, MMM d')}</p>
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-2 h-2 rounded-full bg-primary" />
                                                                <p className="text-lg font-black tracking-tight">{formatMinutes(data.minutes)} <span className="text-[10px] text-muted-foreground uppercase">Studied</span></p>
                                                            </div>
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
                            <CardDescription>Small wins create unstoppable progress.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {stats.achievements.map((a) => (
                                <div key={a.id} className="rounded-xl border bg-muted/20 p-4 hover:scale-[1.02] hover:bg-muted/30 transition-all cursor-default group/ach">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="font-black text-lg truncate group-hover/ach:translate-x-1 transition-transform">{a.title}</div>
                                            <div className="text-xs text-muted-foreground font-medium">{a.description}</div>
                                            {a.unlocked && (
                                                <div className="mt-1 flex items-center gap-1">
                                                    <Sparkles className="w-3 h-3 text-amber-500 animate-pulse" />
                                                    <span className="text-xs font-bold text-amber-600 uppercase tracking-tight">+{a.xp_reward} XP Rewarded</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                            <Badge variant={a.unlocked ? 'default' : 'secondary'} className={cn("shrink-0 font-bold", a.unlocked && "bg-amber-500 hover:bg-amber-600")}>
                                                {a.unlocked ? 'Unlocked' : `${a.progress_percent}%`}
                                            </Badge>
                                            {!a.unlocked && (
                                                <div className="text-[10px] font-bold text-amber-600 uppercase tracking-tighter">
                                                    +{a.xp_reward} XP Reward
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="mt-4 space-y-2">
                                        <div className="shimmer-wrapper rounded-full">
                                            <Progress value={a.progress_percent} className={cn("h-2", a.progress_percent > 0 && "shimmer-active")} />
                                        </div>
                                        <div className="flex justify-between text-[11px] font-bold text-muted-foreground/80 lowercase tracking-tight">
                                            <span>{a.value} / {a.goal}</span>
                                            <span className="uppercase tracking-widest">{a.unlocked ? 'Completed' : 'In progress'}</span>
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
                            <CardContent className="h-[300px] w-full min-h-[300px]">
                                {quizTrends?.score_trend && quizTrends.score_trend.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={quizTrends.score_trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                            <CardContent className="min-h-[220px]">
                                {quizStats?.subject_breakdown && quizStats.subject_breakdown.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={220}>
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
                                    <StreakIcon streak={stats.streak.current} size="md" />
                                    Recent Performance
                                </CardTitle>
                                <CardDescription>Last 10 quizzes average</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {quizHistory.length >= 1 && (
                                        <>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-muted-foreground">Recent Avg. (Last 10)</span>
                                                <span className="font-semibold">
                                                    {quizHistory.length >= 10
                                                        ? `${Math.round(quizHistory.slice(0, 10).reduce((sum, q) => sum + q.percentage, 0) / 10)}%`
                                                        : `${Math.round(quizHistory.reduce((sum, q) => sum + q.percentage, 0) / quizHistory.length)}%`
                                                    }
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-muted-foreground">Best Score</span>
                                                <span className="font-semibold text-green-600">
                                                    {Math.max(...quizHistory.map(q => q.percentage))}%
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-muted-foreground">Most Recent</span>
                                                <span className="font-semibold text-primary">
                                                    {quizHistory[0].percentage}%
                                                </span>
                                            </div>
                                        </>
                                    )}
                                    {quizHistory.length === 0 && (
                                        <div className="text-center py-4">
                                            <p className="text-xs text-muted-foreground">No quiz data yet. Take your first quiz to see insights!</p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Improvement Areas */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="flex items-center gap-2">
                                    <Award className="w-5 h-5 text-amber-500" />
                                    Strengths
                                </CardTitle>
                                <CardDescription>Your highest performing subjects</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {quizStats?.subject_breakdown && quizStats.subject_breakdown.length > 0 ? (
                                        [...quizStats.subject_breakdown]
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
