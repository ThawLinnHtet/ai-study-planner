import { Head, router, usePage } from '@inertiajs/react';
import {
    format,
    parseISO,
    startOfDay,
} from 'date-fns';
import {
    CheckCircle2,
    Lock,
    Unlock,
    Clock,
    BookOpen,
    Flame,
    Sparkles,
    Trophy,
    AlertTriangle,
    Trash2,
    Plus,
    ChevronDown,
    ChevronUp,
    ExternalLink,
    GraduationCap,
    Zap,
    Target,
    Star,
    ArrowRight,
    Brain,
    X,
    Calendar,
    CalendarClock,
} from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem, SharedData } from '@/types';
import { StreakIcon, getStreakMessage, getStreakColor } from '@/components/streak-icon';
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

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Study Planner', href: '/study-planner' },
];

// Types
interface DayData {
    day_number: number;
    status: 'completed' | 'unlocked' | 'locked' | 'locked_daily_limit' | 'locked_future';
    topic: string;
    level: string;
    duration_minutes: number;
    focus_level: string;
    key_topics: string[];
    sub_topics: string[];
    resources: { title: string; url: string; type: string }[];
}

interface LearningPath {
    id: number;
    subject_name: string;
    start_date: string;
    end_date: string;
    total_days: number;
    current_day: number;
    status: string;
    difficulty: number;
    progress_percent: number;
    is_behind_schedule: boolean;
    completed_sessions_count: number;
    days: DayData[];
}

interface CompletedLearningPath {
    id: number;
    subject_name: string;
    total_days: number;
    completed_at: string;
}

interface PageProps {
    learningPaths: LearningPath[];
    completedPaths: CompletedLearningPath[];
    progress: {
        sessions: {
            total: number;
            total_minutes: number;
            today: { sessions: number; minutes: number; xp: number };
            week: { sessions: number; minutes: number; target_minutes: number; target_percent: number };
        };
        streak: { current: number; best: number };
        xp: { total: number; level: number; into_level: number; next_level_at: number; progress_percent: number };
        achievements: any[];
        series: any[];
        insight: string;
    };
    userStreak: number;
    subjectStartDates?: Record<string, string>;
    subjectEndDates?: Record<string, string>;
    isGeneratingPlan?: boolean;
    generatingStatus?: string;
}

// Helpers
const levelColor = (level: string) => {
    switch (level) {
        case 'beginner': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
        case 'intermediate': return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
        case 'advanced': return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
        default: return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30';
    }
};

const levelIcon = (level: string) => {
    switch (level) {
        case 'beginner': return '🌱';
        case 'intermediate': return '🔥';
        case 'advanced': return '⚡';
        default: return '📚';
    }
};

const difficultyLabel = (d: number) => {
    switch (d) {
        case 1: return { text: 'Easy', color: 'text-emerald-400' };
        case 3: return { text: 'Hard', color: 'text-rose-400' };
        default: return { text: 'Medium', color: 'text-amber-400' };
    }
};

const focusColor = (focus: string) => {
    switch (focus) {
        case 'low': return 'bg-blue-500/20 text-blue-400';
        case 'high': return 'bg-orange-500/20 text-orange-400';
        default: return 'bg-violet-500/20 text-violet-400';
    }
};

export default function StudyPlanner({
    learningPaths,
    completedPaths,
    progress,
    userStreak,
    subjectStartDates = {},
    subjectEndDates = {},
    isGeneratingPlan = false,
    generatingStatus = '',
}: PageProps) {
    const page = usePage<SharedData>();
    const flash = page.props.flash;

    // Expanded learning path tracks
    const [expandedPaths, setExpandedPaths] = useState<Set<number>>(new Set());
    // Expanded day details
    const [expandedDay, setExpandedDay] = useState<string | null>(null);
    // Delete dialog
    const [pathToDelete, setPathToDelete] = useState<LearningPath | null>(null);
    const [pathToDeleteInfo, setPathToDeleteInfo] = useState<any>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [purgeHistory, setPurgeHistory] = useState(false);

    // State for tabs
    const [activeTab, setActiveTab] = useState<'daily' | 'upcoming'>('daily');

    // Streak Celebration State
    const [streakCelebration, setStreakCelebration] = useState<StreakCelebrationState | null>(null);
    const [confettiPieces, setConfettiPieces] = useState<ConfettiPiece[]>([]);
    // Timeline visibility
    const [showTimeline, setShowTimeline] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('show_study_timeline');
            return saved !== 'false'; // Default to true
        }
        return true;
    });

    const toggleTimeline = () => {
        const next = !showTimeline;
        setShowTimeline(next);
        localStorage.setItem('show_study_timeline', String(next));
    };

    const celebrationStyleRef = useRef<HTMLStyleElement | null>(null);

    const auth = usePage().props.auth as any;
    const userId = auth?.user?.id;

    // Simulation of progress for better perceived speed
    const [simulatedProgress, setSimulatedProgress] = useState(0);
    const [currentStep, setCurrentStep] = useState(0);
    const steps = [
        "Analyzing learning goals",
        "Curating best-in-class resources",
        "Structuring your learning path",
        "Optimizing for peak productivity",
        "Finalizing your master plan"
    ];

    useEffect(() => {
        let interval: any;
        if (isGeneratingPlan) {
            // Simulated progress logic
            const progressInterval = setInterval(() => {
                setSimulatedProgress(prev => {
                    if (prev >= 95) return 95; // Cap simulated progress
                    const increment = Math.random() * 5;
                    return Math.min(prev + increment, 95);
                });
            }, 800);

            // Step cycling logic
            const stepInterval = setInterval(() => {
                setCurrentStep(prev => (prev < steps.length - 1 ? prev + 1 : prev));
            }, 3000);

            // Real reloading logic
            interval = setInterval(() => {
                router.reload({
                    only: ['learningPaths', 'completedPaths', 'progress', 'isGeneratingPlan', 'generatingStatus']
                });
            }, 1500);

            return () => {
                clearInterval(progressInterval);
                clearInterval(stepInterval);
                if (interval) clearInterval(interval);
            };
        } else {
            setSimulatedProgress(0);
            setCurrentStep(0);
        }
    }, [isGeneratingPlan]);

    // Handle Generation Loading State
    if (isGeneratingPlan) {
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title="Generating Plan..." />
                <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center space-y-8 animate-fade-in">
                    <div className="relative">
                        <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl animate-pulse"></div>
                        <div className="relative bg-white dark:bg-slate-900 p-8 rounded-full shadow-2xl border border-primary/10">
                            <Brain className="w-20 h-20 text-primary animate-bounce-slow" />
                            <Sparkles className="absolute -top-2 -right-2 w-8 h-8 text-amber-400 animate-spin-slow" />
                        </div>
                    </div>

                    <div className="space-y-4 max-w-lg">
                        <Badge variant="outline" className="px-4 py-1 border-primary/20 bg-primary/5 text-primary animate-pulse font-mono tracking-widest text-xs">
                            AI CORE ACTIVE
                        </Badge>
                        <h2 className="text-4xl font-black tracking-tight bg-gradient-to-r from-primary via-indigo-500 to-purple-600 bg-clip-text text-transparent animate-gradient-x leading-tight">
                            {generatingStatus || 'Personalizing Your Learning Path...'}
                        </h2>
                        <p className="text-muted-foreground text-lg leading-relaxed">
                            Neuron AI is crafting your personalized learning journey.
                        </p>
                    </div>

                    <div className="w-full max-w-md space-y-8 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl border border-primary/10 p-8 rounded-3xl shadow-2xl">
                        <div className="space-y-3">
                            <div className="flex justify-between items-end mb-1">
                                <span className="text-xs font-bold uppercase tracking-widest text-primary/70">{steps[currentStep]}</span>
                                <span className="text-xs font-black text-primary">{Math.round(simulatedProgress)}%</span>
                            </div>
                            <div className="h-3 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-primary/5">
                                <div
                                    className="h-full bg-gradient-to-r from-primary via-indigo-500 to-purple-600 rounded-full transition-all duration-1000 ease-out"
                                    style={{ width: `${simulatedProgress}%` }}
                                ></div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            {steps.map((step, idx) => (
                                <div key={idx} className={cn(
                                    "flex items-center gap-4 transition-all duration-500",
                                    idx < currentStep ? "opacity-100" : idx === currentStep ? "opacity-100 scale-105" : "opacity-30"
                                )}>
                                    <div className={cn(
                                        "h-6 w-6 rounded-full flex items-center justify-center border-2",
                                        idx < currentStep ? "bg-primary border-primary text-white" :
                                            idx === currentStep ? "border-primary animate-pulse text-primary" : "border-slate-300 dark:border-slate-700"
                                    )}>
                                        {idx < currentStep ? <CheckCircle2 className="w-4 h-4" /> : <div className="h-1.5 w-1.5 rounded-full bg-current" />}
                                    </div>
                                    <span className={cn(
                                        "text-sm font-bold tracking-tight",
                                        idx === currentStep ? "text-primary" : "text-muted-foreground"
                                    )}>
                                        {step}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-primary/40">
                        <Zap className="w-4 h-4 fill-primary/20" />
                        Harnessing Neuron AI for instant growth
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
        }, 800);

        return () => clearTimeout(timer);
    }, [generateConfettiPieces, progress.streak.current, userId]);

    const dismissCelebration = () => setStreakCelebration(null);

    // Show toast on flash messages
    const flashSignatureRef = useRef<string>('');
    useEffect(() => {
        if (!flash) return;

        const signature = JSON.stringify({
            s: flash.success || '',
            e: flash.error || '',
            i: flash.info || '',
            w: flash.warning || '',
        });
        if (signature === flashSignatureRef.current || signature === '{"s":"","e":"","i":"","w":""}') return;
        flashSignatureRef.current = signature;

        if (flash.success) {
            toast.success(flash.success as string);
        }
        if (flash.error) {
            toast.error(flash.error as string);
        }
        if (flash.info) {
            toast.info(flash.info as string);
        }
        if (flash.warning) {
            toast.warning(flash.warning as string);
        }
    }, [flash, flash?.success, flash?.error, flash?.info, flash?.warning]);

    // Auto-expand the first learning path
    useEffect(() => {
        if (learningPaths.length > 0 && expandedPaths.size === 0) {
            setExpandedPaths(new Set([learningPaths[0].id]));
        }
    }, [learningPaths]);

    const toggleExpand = (id: number) => {
        setExpandedPaths(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const confirmDelete = async (path: LearningPath) => {
        setPathToDelete(path);
        setPurgeHistory(false); // Reset
        try {
            const response = await fetch(`/learning-path/${path.id}/check-delete`);
            const data = await response.json();
            setPathToDeleteInfo(data);
        } catch (error) {
            console.error('Error checking path:', error);
        }
    };

    const handleDeletePath = () => {
        if (!pathToDelete) return;
        setIsDeleting(true);

        router.delete(`/learning-path/${pathToDelete.id}`, {
            data: { purge_history: purgeHistory },
            onSuccess: () => {
                setPathToDelete(null);
                setPathToDeleteInfo(null);
                setIsDeleting(false);
                setPurgeHistory(false);
            },
            onError: () => {
                setIsDeleting(false);
                toast.error('Failed to remove subject.');
            }
        });
    };

    const startDayQuiz = (path: LearningPath, day: DayData) => {
        router.get(`/quiz/practice`, {
            subject: path.subject_name,
            topic: day.topic,
            day_number: day.day_number,
            learning_path_id: path.id,
        });
    };

    // --- Phase 9: Timeline Header Logic ---
    const timelineRef = useRef<HTMLDivElement>(null);
    const today = startOfDay(new Date());

    // Calculate overall range
    const allDates = learningPaths.flatMap(p => [parseISO(p.start_date), parseISO(p.end_date)]);
    const minDate = allDates.length > 0 ? new Date(Math.min(...allDates.map(d => d.getTime()))) : today;
    const maxDate = allDates.length > 0 ? new Date(Math.max(...allDates.map(d => d.getTime()))) : today;

    // Pad range for visual comfort
    const timelineStart = new Date(minDate);
    timelineStart.setDate(timelineStart.getDate() - 2);
    const timelineEnd = new Date(maxDate);
    timelineEnd.setDate(timelineEnd.getDate() + 5);

    const totalDays = Math.ceil((timelineEnd.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24));
    const dayWidth = 60; // pixels per day

    useEffect(() => {
        if (timelineRef.current) {
            const todayOffset = Math.ceil((today.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24)) * dayWidth;
            timelineRef.current.scrollLeft = todayOffset - (timelineRef.current.clientWidth / 2) + (dayWidth / 2);
        }
    }, [learningPaths]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Study Planner" />

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }
                .animate-float {
                    animation: float 3s ease-in-out infinite;
                }
                @keyframes spin-slow {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .animate-spin-slow {
                    animation: spin-slow 8s linear infinite;
                }
                @keyframes fade-in-up {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in-up {
                    animation: fade-in-up 0.6s ease-out forwards;
                }
                @keyframes pulse-slow {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.85; transform: scale(1.02); }
                }
                .animate-pulse-slow {
                    animation: pulse-slow 3s ease-in-out infinite;
                }
            `}} />

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
                                <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
                                    {getStreakHeadline(streakCelebration.milestone)}
                                </h2>
                                <p className="text-slate-600 dark:text-slate-400 text-base leading-relaxed">
                                    {getStreakSubtext(streakCelebration.milestone, streakCelebration.streak)}
                                </p>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
                                <div className="text-left">
                                    <p className="text-sm font-bold text-orange-800 dark:text-orange-300">Keep it up!</p>
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

            {/* Study Timeline Section */}
            {learningPaths.length > 0 && showTimeline && (
                <TooltipProvider>
                    <div className="mb-6 animate-fade-in-up">
                        <div className="flex items-center justify-between mb-3 px-1">
                            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                                <CalendarClock className="w-4 h-4" />
                                Study Timeline
                            </h3>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    if (timelineRef.current) {
                                        const todayOffset = Math.ceil((today.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24)) * dayWidth;
                                        timelineRef.current.scrollTo({ left: todayOffset - (timelineRef.current.clientWidth / 2) + (dayWidth / 2), behavior: 'smooth' });
                                    }
                                }}
                                className="h-7 text-[10px] font-bold uppercase tracking-tighter hover:bg-primary/10 hover:text-primary transition-all"
                            >
                                <Target className="w-3 h-3 mr-1" />
                                Center Today
                            </Button>
                        </div>

                        <div
                            ref={timelineRef}
                            className="relative overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent rounded-2xl border border-border/40 bg-card/30 backdrop-blur-sm"
                        >
                            <div
                                className="relative"
                                style={{ width: `${totalDays * dayWidth}px`, height: `${Math.max(120, (learningPaths.length * 35) + 60)}px` }}
                            >
                                {/* Date labels and vertical markers */}
                                {Array.from({ length: totalDays }).map((_, i) => {
                                    const date = new Date(timelineStart);
                                    date.setDate(date.getDate() + i);
                                    const isToday = date.getTime() === today.getTime();
                                    const isWeekend = date.getDay() === 0 || date.getDay() === 6;

                                    return (
                                        <div
                                            key={i}
                                            className={cn(
                                                "absolute inset-y-0 border-l transition-colors",
                                                isToday ? "border-primary/50 bg-primary/5 z-10" : "border-border/10",
                                                isWeekend && !isToday && "bg-muted/5"
                                            )}
                                            style={{ left: `${i * dayWidth}px`, width: `${dayWidth}px` }}
                                        >
                                            <div className={cn(
                                                "pt-2 text-[10px] font-bold text-center",
                                                isToday ? "text-primary" : "text-muted-foreground/40"
                                            )}>
                                                {format(date, 'MMM d')}
                                            </div>
                                            {isToday && (
                                                <div className="absolute top-0 right-0 left-0 flex justify-center mt-6">
                                                    <Badge className="px-1 py-0 h-4 text-[8px] bg-primary text-primary-foreground font-black uppercase">Today</Badge>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                {/* Subject Strips */}
                                <div className="pt-16 space-y-2 relative z-20">
                                    {learningPaths.map((path, idx) => {
                                        const start = parseISO(path.start_date);
                                        const end = parseISO(path.end_date);
                                        const leftOffset = Math.ceil((start.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24)) * dayWidth;
                                        const durationDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                                        const subColor = getSubjectColor(path.subject_name);

                                        return (
                                            <div key={path.id} className="relative h-7">
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <div
                                                            className={cn(
                                                                "absolute h-full rounded-lg border shadow-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-md cursor-help flex items-center px-3 overflow-hidden group",
                                                                subColor.bg, subColor.border
                                                            )}
                                                            style={{
                                                                left: `${leftOffset}px`,
                                                                width: `${durationDays * dayWidth}px`
                                                            }}
                                                            onClick={() => toggleExpand(path.id)}
                                                        >
                                                            <div className={cn("absolute inset-y-0 left-0 w-1", subColor.primary)}></div>
                                                            <span className={cn("text-[9px] font-black truncate uppercase tracking-tighter opacity-80 group-hover:opacity-100", subColor.text)}>
                                                                {path.subject_name} • {path.progress_percent}%
                                                            </span>
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top" className="p-3 bg-slate-950 text-white border-slate-800 shadow-2xl">
                                                        <div className="space-y-1.5">
                                                            <p className="font-bold text-sm tracking-tight">{path.subject_name}</p>
                                                            <div className="flex items-center gap-3 text-[10px] text-slate-400">
                                                                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {format(start, 'MMM do')} - {format(end, 'MMM do')}</span>
                                                                <span className="flex items-center gap-1 font-bold text-primary">{path.progress_percent}% Complete</span>
                                                            </div>
                                                            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mt-2">
                                                                <div className="h-full bg-primary" style={{ width: `${path.progress_percent}%` }}></div>
                                                            </div>
                                                        </div>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </TooltipProvider>
            )}

            <div className="min-h-screen p-4 md:p-6 space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                            Study Planner
                        </h1>
                        <div className="flex items-center gap-2 mt-1">
                            <p className="text-sm text-muted-foreground">
                                Your personalized learning journey — one day at a time
                            </p>
                            <div className="h-1 w-1 rounded-full bg-muted-foreground/30 mx-1" />
                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/5 border border-primary/10 text-[10px] font-bold text-primary uppercase tracking-wider">
                                <Calendar className="size-3" />
                                {format(new Date(), 'MMMM d, yyyy')}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {learningPaths.length > 0 && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={toggleTimeline}
                                className={cn(
                                    "h-8 text-[10px] font-bold uppercase tracking-wider transition-all",
                                    showTimeline ? "bg-primary/5 border-primary/20 text-primary" : "text-muted-foreground"
                                )}
                            >
                                <CalendarClock className="size-3 mr-2" />
                                {showTimeline ? 'Hide Timeline' : 'Show Timeline'}
                            </Button>
                        )}
                    </div>
                </div>

                {/* Stats Bar */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card className="border border-border/50 bg-card/80 backdrop-blur-sm">
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                                <BookOpen className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{learningPaths.length === 0 ? '—' : learningPaths.length}</p>
                                <p className="text-xs text-muted-foreground">{learningPaths.length === 0 ? 'No active subjects' : 'Active Subjects'}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border border-border/50 bg-card/80 backdrop-blur-sm">
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-orange-500/10 border border-orange-500/20">
                                <Flame className="w-5 h-5 text-orange-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold" title={`${progress?.streak?.current || userStreak} days`}>
                                    {(progress?.streak?.current || userStreak) === 0 ? '—' : (progress?.streak?.current || userStreak)}
                                </p>
                                <p className="text-xs text-muted-foreground">{(progress?.streak?.current || userStreak) === 0 ? 'No streak yet' : (progress?.streak?.current || userStreak) === 1 ? 'Day Streak' : 'Days Streak'}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border border-border/50 bg-card/80 backdrop-blur-sm">
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{progress?.sessions?.today?.sessions === 0 ? '—' : progress?.sessions?.today?.sessions}</p>
                                <p className="text-xs text-muted-foreground">
                                    {progress?.sessions?.today?.sessions === 0 ? 'No sessions today' : progress?.sessions?.today?.sessions === 1 ? 'Session today' : 'Sessions today'}
                                    {progress?.sessions?.total > 0 && <span className="opacity-60 ml-1">({progress.sessions.total} total)</span>}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border border-border/50 bg-card/80 backdrop-blur-sm">
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20">
                                <Trophy className="w-5 h-5 text-violet-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{completedPaths.length === 0 ? '—' : completedPaths.length}</p>
                                <p className="text-xs text-muted-foreground">{completedPaths.length === 0 ? 'No completions' : 'Completed Subjects'}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Empty State (Total) */}
                {learningPaths.length === 0 && (
                    <div className="relative overflow-hidden py-16 md:py-24 flex flex-col items-center justify-center text-center space-y-8 animate-fade-in-up">
                        <div className="relative">
                            <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl animate-pulse"></div>
                            <div className="relative bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl border border-primary/10">
                                <GraduationCap className="w-16 h-16 text-primary animate-float" />
                                <Sparkles className="absolute -top-2 -right-2 w-8 h-8 text-amber-400 animate-spin-slow" />
                            </div>
                        </div>

                        <div className="space-y-4 max-w-lg relative z-10">
                            <h3 className="text-3xl font-black tracking-tight bg-gradient-to-r from-primary to-indigo-600 bg-clip-text text-transparent">
                                Begin Your Mastery Journey
                            </h3>
                            <p className="text-muted-foreground text-lg leading-relaxed">
                                Enroll in a subject to unlock a path crafted by AI, taking you from beginner to expert through a series of focused, achievable steps.
                            </p>
                        </div>

                        <div className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground/60 font-medium">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                Adaptive Difficulty
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                                Progress Protection
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                                Streak Powered
                            </div>
                        </div>

                        <Button
                            onClick={() => router.visit('/onboarding')}
                            size="lg"
                            className="bg-gradient-to-r from-primary to-violet-600 hover:scale-105 active:scale-95 transition-all duration-300 shadow-xl shadow-primary/20 py-7 px-10 text-lg font-bold rounded-2xl"
                        >
                            <Plus className="w-5 h-5 mr-2" />
                            Start Your First Plan
                        </Button>
                    </div>
                )}

                {/* Learning Paths Categorization */}
                {learningPaths.length > 0 && (() => {
                    const today = startOfDay(new Date());
                    const activePathsSorted = [...learningPaths].filter(p => startOfDay(parseISO(p.start_date)) <= today);
                    const futurePaths = [...learningPaths].filter(p => startOfDay(parseISO(p.start_date)) > today);

                    return (
                        <div className="space-y-10">
                            {/* Daily Focus Section */}
                            {activePathsSorted.length > 0 && (
                                <div className="space-y-4 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                                    <div className="flex items-center gap-3 mb-2 px-1">
                                        <div className="w-1.5 h-6 bg-primary rounded-full shadow-[0_0_10px_rgba(var(--primary),0.5)]"></div>
                                        <h2 className="text-xl font-black tracking-tight uppercase">Daily Focus</h2>
                                        <Badge variant="outline" className="ml-auto bg-primary/5 text-primary border-primary/20 font-bold">
                                            {activePathsSorted.length} Active
                                        </Badge>
                                    </div>
                                    <div className="space-y-4">
                                        {activePathsSorted.map((path) => {
                                            const isExpanded = expandedPaths.has(path.id);
                                            const diff = difficultyLabel(path.difficulty);
                                            const daysRemaining = path.total_days - path.current_day + 1;
                                            const subColor = getSubjectColor(path.subject_name);

                                            return (
                                                <Card key={path.id} className={cn("border border-border/50 bg-card/90 backdrop-blur-sm overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 relative", isExpanded && "ring-1 ring-primary/20 shadow-xl overflow-visible")}>
                                                    {/* Subject Identifer Strip */}
                                                    <div className={cn("absolute inset-y-0 left-0 w-1.5 z-20", subColor.primary)}></div>

                                                    {/* Track Header */}
                                                    <div
                                                        className="flex items-center gap-4 p-4 md:p-5 cursor-pointer select-none hover:bg-muted/30 transition-colors relative z-10"
                                                        onClick={() => toggleExpand(path.id)}
                                                    >
                                                        <div className={cn("flex-shrink-0 w-12 h-12 rounded-xl border flex items-center justify-center transition-all duration-300", subColor.bg, subColor.border, isExpanded && "scale-110 shadow-lg " + subColor.glow)}>
                                                            <BookOpen className={cn("w-6 h-6", subColor.text)} />
                                                        </div>

                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <h3 className="font-bold text-lg truncate">{path.subject_name}</h3>
                                                                {path.is_behind_schedule && (
                                                                    <Badge variant="outline" className="bg-rose-500/10 text-rose-400 border-rose-500/30 text-xs animate-pulse">
                                                                        <AlertTriangle className="w-3 h-3 mr-1" />
                                                                        Behind
                                                                    </Badge>
                                                                )}
                                                                <span className={`text-xs font-medium ${diff.color}`}>{diff.text}</span>
                                                            </div>
                                                            <div className="flex items-center gap-4 mt-1.5">
                                                                <span className="text-xs text-muted-foreground">
                                                                    Day {path.current_day} of {path.total_days}
                                                                </span>
                                                                <span className="text-xs text-muted-foreground">
                                                                    {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} left
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-3">
                                                            <div className="hidden md:flex flex-col items-end">
                                                                <span className="text-sm font-bold text-primary">{path.progress_percent}%</span>
                                                                <div className="w-24 mt-1">
                                                                    <Progress value={path.progress_percent} className="h-1.5" />
                                                                </div>
                                                            </div>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    confirmDelete(path);
                                                                }}
                                                                className="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                            {isExpanded ? (
                                                                <ChevronUp className="w-5 h-5 text-muted-foreground" />
                                                            ) : (
                                                                <ChevronDown className="w-5 h-5 text-muted-foreground" />
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Mobile progress bar */}
                                                    <div className="px-4 pb-2 md:hidden">
                                                        <div className="flex items-center gap-2">
                                                            <Progress value={path.progress_percent} className="h-1.5 flex-1" />
                                                            <span className="text-xs font-bold text-primary">{path.progress_percent}%</span>
                                                        </div>
                                                    </div>

                                                    {/* Day-by-Day Timeline */}
                                                    {isExpanded && (
                                                        <div className="border-t border-border/40 p-4 md:p-5 space-y-2 animate-in slide-in-from-top-2 duration-200">
                                                            {path.is_behind_schedule && (
                                                                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 mb-3">
                                                                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                                                                    <p className="text-xs text-amber-400">
                                                                        You're behind schedule! Try to complete extra days this week to catch up. 💪
                                                                    </p>
                                                                </div>
                                                            )}

                                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-2">
                                                                {path.days.map((day) => {
                                                                    const isUnlocked = day.status === 'unlocked' || day.status === 'completed';
                                                                    const isCurrent = day.day_number === path.current_day;
                                                                    const isSelected = expandedDay === `${path.id}-${day.day_number}`;
                                                                    const isLockedDailyLimit = day.status === 'locked_daily_limit';
                                                                    const isLockedFuture = day.status === 'locked_future';

                                                                    return (
                                                                        <button
                                                                            key={day.day_number}
                                                                            disabled={day.status === 'locked' || isLockedDailyLimit || isLockedFuture}
                                                                            className={cn(
                                                                                "relative p-3 rounded-xl border text-left transition-all duration-300 group overflow-hidden",
                                                                                day.status === 'completed'
                                                                                    ? "bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/15"
                                                                                    : isLockedDailyLimit
                                                                                        ? "bg-amber-500/5 border-amber-500/30 ring-1 ring-amber-500/20 shadow-sm opacity-90 cursor-not-allowed"
                                                                                        : isCurrent
                                                                                            ? cn("bg-primary/10 border-primary/40 hover:bg-primary/15 ring-2 ring-primary/20 animate-pulse-slow shadow-lg", subColor.glow)
                                                                                            : (day.status === 'locked' || isLockedFuture)
                                                                                                ? "opacity-30 grayscale cursor-not-allowed border-border/20"
                                                                                                : cn("bg-muted/20 border-border/30 hover:bg-muted/30 hover:border-primary/30", subColor.bg.replace('/10', '/5')),
                                                                                isSelected && !isCurrent && !isLockedDailyLimit && "ring-2 " + subColor.border.replace('/20', '/60') + " " + subColor.bg.replace('/10', '/20')
                                                                            )}
                                                                            onClick={() => isUnlocked && setExpandedDay(isSelected ? null : `${path.id}-${day.day_number}`)}
                                                                        >
                                                                            {isCurrent && (
                                                                                <div className={cn("absolute -bottom-4 -right-4 w-12 h-12 rounded-full blur-2xl opacity-40", subColor.primary)}></div>
                                                                            )}

                                                                            <div className="flex items-center justify-between mb-1.5 relative z-10">
                                                                                <span className={cn(
                                                                                    "text-xs font-black tracking-tight",
                                                                                    day.status === 'completed' ? "text-emerald-500" : (isLockedDailyLimit || isLockedFuture) ? "text-amber-500" : isCurrent ? subColor.text : "text-muted-foreground"
                                                                                )}>
                                                                                    DAY {day.day_number}
                                                                                </span>
                                                                                <div className="transition-transform group-hover:scale-110 duration-300">
                                                                                    {day.status === 'completed' ? (
                                                                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                                                                    ) : isLockedDailyLimit ? (
                                                                                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                                                                                    ) : isLockedFuture ? (
                                                                                        <Calendar className="w-3.5 h-3.5 text-amber-500" />
                                                                                    ) : day.status === 'locked' ? (
                                                                                        <Lock className="w-3 h-3 text-muted-foreground/50" />
                                                                                    ) : (
                                                                                        <Zap className={cn("w-3.5 h-3.5 animate-pulse", subColor.text)} />
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                            <p className={cn(
                                                                                "text-[10px] font-bold leading-tight line-clamp-2 min-h-[1.5rem] transition-colors",
                                                                                day.status === 'locked' ? "text-muted-foreground" : isLockedDailyLimit ? "text-amber-600/80" : "text-foreground group-hover:" + subColor.text
                                                                            )}>
                                                                                {isLockedDailyLimit ? 'Come back tomorrow to unlock' : isLockedFuture ? 'Unlocks at 12:00 AM' : day.topic}
                                                                            </p>
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>

                                                            {/* Expanded Day Details */}
                                                            {expandedDay && expandedDay.startsWith(`${path.id}-`) && (() => {
                                                                const dayNumber = parseInt(expandedDay.split('-')[1]);
                                                                const day = path.days.find(d => d.day_number === dayNumber);
                                                                if (!day) return null;
                                                                const isCurrent = day.day_number === path.current_day;

                                                                return (
                                                                    <Card className="mt-4 border border-border/50 bg-gradient-to-br from-card to-muted/20 animate-in slide-in-from-top-2 duration-200">
                                                                        <CardHeader className="pb-3 border-b border-border/40">
                                                                            <div className="flex items-center justify-between">
                                                                                <div className="flex items-center gap-3">
                                                                                    <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                                                                                        <Target className="w-5 h-5 text-primary" />
                                                                                    </div>
                                                                                    <div>
                                                                                        <CardTitle className="text-lg">Day {day.day_number}: {day.topic}</CardTitle>
                                                                                        <div className="flex items-center gap-3 mt-1">
                                                                                            <Badge variant="outline" className="gap-1 px-2 py-0.5 normal-case">
                                                                                                <Clock className="w-3 h-3" />
                                                                                                {day.duration_minutes} mins
                                                                                            </Badge>
                                                                                            <Badge variant="outline" className="gap-1 px-2 py-0.5 normal-case capitalize">
                                                                                                <Brain className="w-3 h-3" />
                                                                                                {day.level}
                                                                                            </Badge>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                                <Button variant="ghost" size="icon" onClick={() => setExpandedDay(null)}>
                                                                                    <X className="w-4 h-4" />
                                                                                </Button>
                                                                            </div>
                                                                        </CardHeader>
                                                                        <CardContent className="pt-6 space-y-6">
                                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                                                <div className="space-y-4">
                                                                                    <h4 className="text-sm font-semibold flex items-center gap-2">
                                                                                        <Star className="w-4 h-4 text-amber-400" />
                                                                                        Key Topics
                                                                                    </h4>
                                                                                    <ul className="space-y-2">
                                                                                        {day.key_topics.map((t, i) => (
                                                                                            <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                                                                                                <ArrowRight className="w-3 h-3 mt-1 text-primary/60" />
                                                                                                {t}
                                                                                            </li>
                                                                                        ))}
                                                                                    </ul>
                                                                                </div>
                                                                                {day.resources.length > 0 && (
                                                                                    <div className="space-y-4">
                                                                                        <h4 className="text-sm font-semibold flex items-center gap-2">
                                                                                            <Sparkles className="w-4 h-4 text-violet-400" />
                                                                                            Learning Resources
                                                                                        </h4>
                                                                                        <div className="grid grid-cols-1 gap-2">
                                                                                            {day.resources.map((res, i) => (
                                                                                                <a
                                                                                                    key={i}
                                                                                                    href={res.url}
                                                                                                    target="_blank"
                                                                                                    rel="noopener noreferrer"
                                                                                                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-primary/5 border border-border/40 hover:border-primary/30 transition-all group"
                                                                                                >
                                                                                                    <div className="flex items-center gap-3">
                                                                                                        {res.type === 'video' ? <Zap className="w-4 h-4 text-red-500" /> : <BookOpen className="w-4 h-4 text-blue-500" />}
                                                                                                        <span className="text-sm font-medium">{res.title}</span>
                                                                                                    </div>
                                                                                                    <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-all" />
                                                                                                </a>
                                                                                            ))}
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                            {isCurrent && (
                                                                                <div className="pt-6 border-t border-border/40">
                                                                                    <Button
                                                                                        className="w-full bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90 text-white shadow-lg shadow-primary/20"
                                                                                        onClick={() => startDayQuiz(path, day)}
                                                                                        size="lg"
                                                                                    >
                                                                                        <GraduationCap className="w-5 h-5 mr-2" />
                                                                                        Complete Lesson & Take Quiz
                                                                                    </Button>
                                                                                </div>
                                                                            )}
                                                                        </CardContent>
                                                                    </Card>
                                                                );
                                                            })()}
                                                        </div>
                                                    )}
                                                </Card>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Upcoming Journeys Section */}
                            {futurePaths.length > 0 && (
                                <div className="space-y-4 pt-6 border-t border-dashed border-border/40 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                                    <div className="flex items-center gap-3 mb-2 px-1 text-foreground/70">
                                        <div className="w-1.5 h-6 bg-amber-500/50 rounded-full"></div>
                                        <h2 className="text-xl font-bold tracking-tight uppercase">Upcoming Journeys</h2>
                                        <Badge variant="outline" className="ml-auto bg-amber-500/5 text-amber-500 border-amber-500/20 font-bold">
                                            {futurePaths.length} Scheduled
                                        </Badge>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {futurePaths.map((path) => {
                                            const subColor = getSubjectColor(path.subject_name);
                                            const startDate = parseISO(path.start_date);
                                            const daysUntil = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                                            return (
                                                <Card key={path.id} className="border border-border/40 bg-card/40 backdrop-blur-sm grayscale-[0.6] hover:grayscale-0 transition-all duration-500 group">
                                                    <CardContent className="p-5 flex items-center gap-4">
                                                        <div className={cn("w-12 h-12 rounded-xl border flex items-center justify-center bg-card shadow-sm group-hover:scale-110 transition-transform", subColor.border.replace('/20', '/10'))}>
                                                            <Calendar className={cn("w-6 h-6", subColor.text)} />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <h4 className="font-bold truncate">{path.subject_name}</h4>
                                                                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px] font-black uppercase tracking-widest px-1.5 py-0">
                                                                    Coming Soon
                                                                </Badge>
                                                            </div>
                                                            <p className="text-sm text-muted-foreground mt-0.5">
                                                                Starts {format(startDate, 'MMM do')} • <strong>In {daysUntil} day{daysUntil === 1 ? '' : 's'}</strong>
                                                            </p>
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => confirmDelete(path)}
                                                            className="text-muted-foreground/40 hover:text-destructive transition-colors shrink-0"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </CardContent>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Enjoy the Calm Empty State */}
                            {activePathsSorted.length === 0 && futurePaths.length > 0 && (
                                <Card className="border-dashed border-primary/20 bg-primary/5 py-16 animate-fade-in-up">
                                    <CardContent className="flex flex-col items-center text-center space-y-6">
                                        <div className="relative">
                                            <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl animate-pulse"></div>
                                            <div className="relative p-6 rounded-3xl bg-white dark:bg-slate-900 shadow-xl border border-primary/10">
                                                <Sparkles className="w-10 h-10 text-primary animate-float" />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <h3 className="text-2xl font-black">Enjoy the calm!</h3>
                                            <p className="text-muted-foreground text-lg max-w-sm mt-1 leading-relaxed">
                                                No subjects have started yet. Your first journey begins in <strong className="text-foreground">{Math.ceil((parseISO(futurePaths[0].start_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))} days</strong>.
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    );
                })()}

                {/* Completed Learning Paths */}
                {completedPaths.length > 0 && (
                    <Card className="border border-border/50 bg-card/80 mt-12">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                <Trophy className="w-4 h-4 text-amber-400" />
                                Completed Subjects
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {completedPaths.map((ce) => (
                                    <div key={ce.id} className="flex items-center gap-3 p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
                                        <div className="p-2 rounded-lg bg-emerald-500/10">
                                            <Trophy className="w-4 h-4 text-emerald-400" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm">{ce.subject_name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {ce.total_days} day{ce.total_days !== 1 ? 's' : ''} • Completed {format(parseISO(ce.completed_at), 'MMM d, yyyy')}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Emotional Delete Dialog */}
                <Dialog open={!!pathToDelete} onOpenChange={(open) => {
                    if (!open) {
                        setPathToDelete(null);
                        setPathToDeleteInfo(null);
                    }
                }}>
                    <DialogContent className="sm:max-w-md">
                        {pathToDeleteInfo?.has_progress ? (
                            <>
                                <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2 text-amber-400">
                                        <AlertTriangle className="w-5 h-5" />
                                        Wait! You've Made Progress! 🥺
                                    </DialogTitle>
                                    <DialogDescription className="pt-3 space-y-3">
                                        <p className="text-base">
                                            {pathToDeleteInfo.completed_sessions <= 2 ? (
                                                <>
                                                    You've already completed <strong className="text-foreground">{pathToDeleteInfo.completed_sessions} study session{pathToDeleteInfo.completed_sessions !== 1 ? 's' : ''}</strong> of {pathToDelete?.subject_name}!
                                                    Even one hour of focus is a huge win for your future self. 🌟
                                                </>
                                            ) : (
                                                <>
                                                    You've already completed <strong className="text-foreground">{pathToDeleteInfo.completed_days} day{pathToDeleteInfo.completed_days !== 1 ? 's' : ''}</strong> of {pathToDelete?.subject_name}!
                                                    That's <strong className="text-foreground">{pathToDeleteInfo.completed_sessions} study session{pathToDeleteInfo.completed_sessions !== 1 ? 's' : ''}</strong> of hard work and dedication. 😢
                                                </>
                                            )}
                                        </p>
                                        <div className="p-4 rounded-lg bg-amber-500/5 border border-amber-500/20">
                                            <p className="text-sm italic text-amber-400/80">
                                                {pathToDeleteInfo.completed_sessions <= 2
                                                    ? "\"The first steps are often the hardest. Your efforts so far are proof of your commitment.\" ✨"
                                                    : "\"Every day of learning is a step towards mastery. Your progress matters, even if you decide to start fresh.\" 🌟"}
                                            </p>
                                        </div>
                                        <p className="text-sm font-medium text-foreground/80">
                                            Are you absolutely sure you want to remove this Learning Path?
                                        </p>
                                        <div className="flex items-start space-x-3 p-3 rounded-lg border border-destructive/20 bg-destructive/5 mt-4">
                                            <Checkbox
                                                id="purge-history"
                                                checked={purgeHistory}
                                                onCheckedChange={(checked) => setPurgeHistory(!!checked)}
                                                className="mt-1 border-destructive/50 data-[state=checked]:bg-destructive data-[state=checked]:text-destructive-foreground"
                                            />
                                            <div className="grid gap-1.5 leading-none">
                                                <Label
                                                    htmlFor="purge-history"
                                                    className="text-sm font-bold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-destructive/90"
                                                >
                                                    Delete all historical progress
                                                </Label>
                                                <p className="text-[11px] text-muted-foreground leading-snug">
                                                    This will permanently remove all study sessions, XP, and stats associated with {pathToDelete?.subject_name}. This cannot be undone.
                                                </p>
                                            </div>
                                        </div>
                                    </DialogDescription>
                                </DialogHeader>
                                <DialogFooter className="gap-2 sm:gap-0">
                                    <Button variant="outline" onClick={() => setPathToDelete(null)} disabled={isDeleting}>
                                        Keep Studying 💪
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        onClick={handleDeletePath}
                                        disabled={isDeleting}
                                    >
                                        {isDeleting ? 'Removing...' : 'Remove Anyway 😔'}
                                    </Button>
                                </DialogFooter>
                            </>
                        ) : (
                            <>
                                <DialogHeader>
                                    <DialogTitle>Remove Learning Path</DialogTitle>
                                    <DialogDescription>
                                        Are you sure you want to remove the <strong>{pathToDelete?.subject_name}</strong> path? You haven't started any sessions yet, so nothing will be lost.
                                    </DialogDescription>
                                </DialogHeader>
                                <DialogFooter className="gap-2 sm:gap-0">
                                    <Button variant="outline" onClick={() => setPathToDelete(null)} disabled={isDeleting}>
                                        Cancel
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        onClick={handleDeletePath}
                                        disabled={isDeleting}
                                    >
                                        {isDeleting ? 'Removing...' : 'Remove Path'}
                                    </Button>
                                </DialogFooter>
                            </>
                        )}
                    </DialogContent>
                </Dialog>
            </div>
        </AppLayout>
    );
}
