import { Head, useForm, usePage, router } from '@inertiajs/react';
import {
    AlertTriangle,
    BookOpen,
    Clock,
    User as UserIcon,
    Brain,
    X,
    Sunrise,
    Sun,
    Sunset,
    Moon,
    CalendarDays,
    Timer,
    Target,
    Settings as SettingsIcon,
    Compass as CompassIcon,
    Lightbulb
} from 'lucide-react';
import { useState, useEffect, useRef, useMemo } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import InputError from '@/components/input-error';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SimpleAutocomplete } from '@/components/ui/simple-autocomplete';
import { toast } from '@/hooks/use-toast';
import { useSimpleSubjects } from '@/hooks/useSimpleSubjects';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem, SharedData } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Settings',
        href: '/settings',
    },
    {
        title: 'Study Preferences',
        href: '/settings/onboarding',
    },
];

interface User {
    id: number;
    name: string;
    email: string;
    subjects: string[];
    subject_difficulties: Record<string, number>;
    subject_session_durations: Record<string, { min: number; max: number }>;
    subject_start_dates: Record<string, string>;
    subject_end_dates: Record<string, string>;
    daily_study_hours: number | null;
    study_goal: string | null;
    timezone: string | null;
    onboarding_completed: boolean;
    onboarding_step: number;
    is_generating_plan?: boolean;
    generating_status?: string;
}

interface Enrollment {
    id: number;
    subject_name: string;
    start_date: string;
    end_date: string;
    completed_sessions_count: number;
    current_day: number;
    total_days: number;
    progress_percent: number;
}

interface Props {
    user: User;
    activePlan: unknown;
    activeEnrollments: Enrollment[];
}

const parseSubjects = (subjects: unknown): string[] => {
    if (Array.isArray(subjects)) {
        return subjects as string[];
    }

    if (typeof subjects === 'string') {
        try {
            const parsed = JSON.parse(subjects) as unknown;
            return Array.isArray(parsed) ? (parsed as string[]) : [];
        } catch {
            return [];
        }
    }

    return [];
};

interface OnboardingFlash {
    success?: string;
    error?: string;
    info?: string;
    warning?: string;
    hours_adjusted?: boolean;
    original_hours?: number;
    recommended_hours?: number;
    onboarding_warning?: {
        title: string;
        message: string | string[];
        recommendations: string[];
    };
}

// Track previously shown flash messages globally to prevent duplicates even with React StrictMode (double-mount)
export default function OnboardingSettings({ user, activeEnrollments }: Props) {
    const page = usePage<SharedData>();
    const flash = page.props.flash as OnboardingFlash;

    // Polling for plan generation
    useEffect(() => {
        let interval: any;
        if (user.is_generating_plan) {
            interval = setInterval(() => {
                router.reload({
                    only: ['user', 'activePlan', 'activeEnrollments']
                });
            }, 3000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [user.is_generating_plan]);

    if (user.is_generating_plan) {
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title="Generating Plan..." />
                <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center space-y-8">
                    <div className="relative">
                        <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl animate-pulse"></div>
                        <div className="relative bg-white dark:bg-slate-900 p-8 rounded-full shadow-2xl border border-primary/10">
                            <Brain className="w-20 h-20 text-primary animate-bounce-slow" />
                            <Lightbulb className="absolute -top-2 -right-2 w-8 h-8 text-amber-400 animate-spin-slow" />
                        </div>
                    </div>

                    <div className="space-y-4 max-w-lg">
                        <h2 className="text-3xl font-black tracking-tight bg-gradient-to-r from-primary to-indigo-600 bg-clip-text text-transparent">
                            Regenerating Your Plan
                        </h2>
                        <p className="text-muted-foreground text-lg leading-relaxed">
                            {user.generating_status || "Our AI is updating your personalized path based on your new preferences. This usually takes about 20-30 seconds."}
                        </p>
                    </div>

                    <div className="w-full max-w-xs space-y-2">
                        <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-primary/60 px-1">
                            <div className="flex items-center gap-2">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                                </span>
                                <span>Optimization in Progress</span>
                            </div>
                            <span className="animate-pulse">Working...</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-primary animate-progress-loading"></div>
                        </div>
                    </div>
                </div>
                <style dangerouslySetInnerHTML={{
                    __html: `
                    @keyframes progress-loading {
                        0% { width: 0; }
                        50% { width: 70%; }
                        100% { width: 100%; }
                    }
                    .animate-progress-loading {
                        animation: progress-loading 2s ease-in-out infinite;
                    }
                `}} />
            </AppLayout>
        );
    }
    // Initialize form with fresh user data on every render
    const formatDuration = (min: number) => {
        if (!min) return '';
        if (min < 60) return `${min} min`;
        const hours = Math.floor(min / 60);
        const remainingMin = min % 60;
        return remainingMin === 0 ? `${hours}h` : `${hours}h ${remainingMin}min`;
    };

    const form = useForm({
        subjects: parseSubjects(user.subjects),
        subject_start_dates: user.subject_start_dates || {},
        subject_end_dates: user.subject_end_dates || {},
        subject_difficulties: user.subject_difficulties || {} as Record<string, number>,
        subject_session_durations: user.subject_session_durations || {} as Record<string, { min: number; max: number }>,
        daily_study_hours: user.daily_study_hours || 2,
        study_goal: user.study_goal || '',
        timezone: user.timezone || '',
        regenerate_plan: false,
        purged_subjects: [] as string[],
    });

    // TanStack Query for subjects
    const { allSubjects, addCustomSubject, useSearchSuggestions } = useSimpleSubjects();
    const [subjectInputValue, setSubjectInputValue] = useState('');
    const [subjectsKey, setSubjectsKey] = useState(0); // Force re-render

    // Search suggestions hook
    const { data: searchData } = useSearchSuggestions(subjectInputValue);
    const suggestions = searchData?.subjects || [];

    const getDayCount = (subject: string): number | null => {
        const start = form.data.subject_start_dates?.[subject];
        const end = form.data.subject_end_dates?.[subject];
        if (!start || !end) return null;
        const startDate = new Date(start);
        const endDate = new Date(end);
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return null;
        const diffTime = endDate.getTime() - startDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        return diffDays > 0 ? diffDays : null;
    };

    const subjectsMissingDates = useMemo(() => {
        return form.data.subjects.filter(s => !form.data.subject_start_dates[s] || !form.data.subject_end_dates[s]);
    }, [form.data.subjects, form.data.subject_start_dates, form.data.subject_end_dates]);

    const hasCoreChanges = useMemo(() => {
        // Compare current form data with initial user props
        const initialSubjects = parseSubjects(user.subjects).sort();
        const currentSubjects = [...form.data.subjects].sort();

        if (JSON.stringify(initialSubjects) !== JSON.stringify(currentSubjects)) return true;
        if (form.data.daily_study_hours !== (user.daily_study_hours || 2)) return true;
        if (form.data.study_goal !== (user.study_goal || '')) return true;
        if (form.data.timezone !== (user.timezone || '')) return true;

        // Check subject-specific core fields
        for (const s of form.data.subjects) {
            if (form.data.subject_start_dates[s] !== (user.subject_start_dates?.[s] || '')) return true;
            if (form.data.subject_end_dates[s] !== (user.subject_end_dates?.[s] || '')) return true;
            if (form.data.subject_difficulties[s] !== (user.subject_difficulties?.[s] || 2)) return true;
        }

        return false;
    }, [form.data, user]);

    const flashSignatureRef = useRef<string>('');

    useEffect(() => {
        if (!flash) return;

        const signature = JSON.stringify(flash);
        if (signature === flashSignatureRef.current) return;
        flashSignatureRef.current = signature;

        if (flash.success) {
            toast.success(flash.success);
        }
        if (flash.error) {
            toast.error(flash.error);
        }
        if (flash.info) {
            toast.info(flash.info);
        }
        if (flash.warning) {
            toast.warning(flash.warning);
        }
    }, [flash]);



    const addSubject = async (subjectName: string) => {
        if (!form.data.subjects.includes(subjectName)) {
            // Check if this is a custom subject (not in the dynamic subjects list)
            const predefinedSubjects = allSubjects || [];
            const isCustomSubject = !predefinedSubjects.includes(subjectName);

            const newSubjects = [...form.data.subjects, subjectName];
            const newDifficulties = {
                ...form.data.subject_difficulties,
                [subjectName]: 2, // Default difficulty
            };

            // Update form data immediately
            form.setData((prev: any) => ({
                ...prev,
                subjects: newSubjects,
                subject_difficulties: newDifficulties,
            }));

            setSubjectInputValue('');

            // Force re-render of subjects list
            setSubjectsKey((prev: number) => prev + 1);

            // Add to database in background (non-blocking)
            if (isCustomSubject) {
                addCustomSubject(subjectName)
                    .then(() => {
                        // Success - subject is already in UI
                    })
                    .catch((error) => {
                        console.log('Failed to add custom subject to DB:', error);
                    });
            }
        }
    };

    // Emotional delete dialog state
    const [subjectToRemove, setSubjectToRemove] = useState<string | null>(null);
    const [subjectRemoveInfo, setSubjectRemoveInfo] = useState<any>(null);
    const [purgeHistory, setPurgeHistory] = useState(false);

    const removeSubject = (subject: string) => {
        // Check if this subject has an active enrollment
        const enrollment = activeEnrollments.find(
            (e) => e.subject_name === subject
        );

        // Always show confirmation now for consistency
        setSubjectToRemove(subject);
        setSubjectRemoveInfo(enrollment || null);
    };

    const doRemoveSubject = (subject: string) => {
        const newSubjects = form.data.subjects.filter((s: string) => s !== subject);
        const newDifficulties = { ...form.data.subject_difficulties };
        delete newDifficulties[subject];

        // Also clear dates and durations
        const newStartDates = { ...form.data.subject_start_dates };
        const newEndDates = { ...form.data.subject_end_dates };
        const newDurations = { ...form.data.subject_session_durations };
        delete newStartDates[subject];
        delete newEndDates[subject];
        delete newDurations[subject];

        const newPurged = [...form.data.purged_subjects];
        if (purgeHistory && !newPurged.includes(subject)) {
            newPurged.push(subject);
        }

        form.setData({
            ...form.data,
            subjects: newSubjects,
            subject_difficulties: newDifficulties,
            subject_start_dates: newStartDates,
            subject_end_dates: newEndDates,
            subject_session_durations: newDurations,
            purged_subjects: newPurged,
        });

        // Reset purgeHistory for next time
        setPurgeHistory(false);

        // Force re-render
        setSubjectsKey((prev) => prev + 1);

        // Close dialog if open
        setSubjectToRemove(null);
        setSubjectRemoveInfo(null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Only explicitly request regeneration if there are core changes
        form.transform((data) => ({
            ...data,
            regenerate_plan: hasCoreChanges
        }));

        form.put('/settings/onboarding', {
            onError: (errors: Record<string, string>) => {
                toast.error('Failed to save preferences: ' + Object.values(errors).join(', '));
            }
        });
    };

    const updateSubjectDifficulty = (subject: string, difficulty: number) => {
        form.setData('subject_difficulties', {
            ...form.data.subject_difficulties,
            [subject]: difficulty,
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Study Preferences" />

            <div className="p-6 max-w-4xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-semibold">Study Schedule</h3>
                        <p className="text-sm text-muted-foreground">
                            Update your preferences and generate a new study plan
                        </p>
                    </div>
                </div>

                {/* Perfection Grade Alerts */}
                {flash?.onboarding_warning && (
                    <Alert className="border-amber-200 bg-amber-50 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                        <div className="ml-3">
                            <div className="text-amber-800 font-bold text-sm">
                                Sustainability Safeguard
                            </div>
                            <div className="text-amber-700 mt-1 text-sm leading-relaxed">
                                {Array.isArray((flash.onboarding_warning as any).message) ? (
                                    <ul className="list-disc list-inside space-y-1">
                                        {(flash.onboarding_warning as any).message.map((msg: string, idx: number) => (
                                            <li key={idx}>{msg}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    (flash.onboarding_warning as any).message
                                )}

                                {(flash.onboarding_warning as any).recommendations && (flash.onboarding_warning as any).recommendations.length > 0 && (
                                    <div className="mt-3 bg-white/60 rounded-lg p-3 border border-amber-200 shadow-sm">
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold mb-2 text-amber-900 uppercase tracking-wider">
                                            <Lightbulb className="size-3 text-amber-600" />
                                            Assistant Recommendations:
                                        </div>
                                        <ul className="space-y-1.5 text-xs">
                                            {(flash.onboarding_warning as any).recommendations.map((rec: string, idx: number) => (
                                                <li key={idx} className="flex items-start gap-2">
                                                    <span className="mt-1.5 h-1 w-1 rounded-full bg-amber-500 shrink-0" />
                                                    {rec}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                    </Alert>
                )}

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* General Preferences Card */}
                    <Card className="border-primary/20 bg-primary/5">
                        <CardHeader className="pb-4">
                            <CardTitle className="flex items-center gap-2 text-primary">
                                <SettingsIcon className="w-5 h-5" />
                                General Preferences
                            </CardTitle>
                            <CardDescription>
                                High-level goals and schedule constraints for your entire plan
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Study Hours */}
                                <div className="space-y-2">
                                    <Label htmlFor="daily_study_hours" className="flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-primary" />
                                        Daily Study Hours
                                    </Label>
                                    <Select
                                        value={form.data.daily_study_hours.toString()}
                                        onValueChange={(value) => form.setData('daily_study_hours', parseInt(value))}
                                    >
                                        <SelectTrigger id="daily_study_hours">
                                            <SelectValue placeholder="Select hours" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {[1, 2, 3, 4, 5, 6].map((hour) => (
                                                <SelectItem key={hour} value={hour.toString()}>
                                                    {hour} {hour === 1 ? 'hour' : 'hours'}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[10px] text-muted-foreground">
                                        Limit: 6 hours/day for focus.
                                    </p>
                                </div>

                                {/* Study Goal */}
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <Target className="w-4 h-4 text-primary" />
                                        Main Objective
                                    </Label>
                                    <Select
                                        value={form.data.study_goal}
                                        onValueChange={(value) => form.setData('study_goal', value)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a goal" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Build strong foundation">Build Foundation</SelectItem>
                                            <SelectItem value="Achieve top performance">Top Performance</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[10px] text-muted-foreground">
                                        Influences session intensity.
                                    </p>
                                </div>

                                {/* Timezone */}
                                <div className="space-y-2">
                                    <Label htmlFor="timezone" className="flex items-center gap-2">
                                        <CompassIcon className="w-4 h-4 text-primary" />
                                        Your Timezone
                                    </Label>
                                    <Input
                                        id="timezone"
                                        value={form.data.timezone}
                                        onChange={(e) => form.setData('timezone', e.target.value)}
                                        placeholder="e.g., Asia/Yangon"
                                        className="h-10"
                                    />
                                    {form.errors.timezone && (
                                        <p className="text-[10px] text-destructive">{form.errors.timezone}</p>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Subject Management Card */}
                    <Card>
                        <CardHeader className="pb-4">
                            <CardTitle className="flex items-center gap-2">
                                <BookOpen className="w-5 h-5 text-primary" />
                                Subject Configuration
                            </CardTitle>
                            <CardDescription>
                                Customize each subject. Add/remove subjects and refine their specific details.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Add Subject Search */}
                            <div className="p-4 bg-muted/30 rounded-xl border border-dashed">
                                <div className="max-w-xl mx-auto space-y-3">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-sm font-medium">Add New Subject</Label>
                                        <Badge variant={form.data.subjects.length >= 6 ? "destructive" : "secondary"} className="font-bold">
                                            {form.data.subjects.length}/6 Subjects
                                        </Badge>
                                    </div>
                                    <SimpleAutocomplete
                                        value={subjectInputValue}
                                        onValueChange={setSubjectInputValue}
                                        onSelect={addSubject}
                                        suggestions={suggestions}
                                        selectedSubjects={form.data.subjects}
                                        onRemoveSubject={removeSubject}
                                        placeholder={form.data.subjects.length >= 6 ? "Limit reached (6/6)" : "Search or add a subject..."}
                                        className="w-full h-11"
                                        disabled={form.data.subjects.length >= 6}
                                    />
                                    {form.data.subjects.length >= 6 && (
                                        <p className="text-[10px] text-destructive font-medium flex items-center gap-1.5 px-1 animate-pulse">
                                            <AlertTriangle className="size-3" />
                                            Subject limit reached. Focus on these 6 for the best results!
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Subjects List */}
                            {form.data.subjects && form.data.subjects.length > 0 ? (
                                <div className="grid gap-4">
                                    {form.data.subjects.map((subject: string) => {
                                        const startError = (form.errors as Record<string, string | undefined>)[`subject_start_dates.${subject}`];
                                        const endError = (form.errors as Record<string, string | undefined>)[`subject_end_dates.${subject}`];
                                        const duration = form.data.subject_session_durations?.[subject];
                                        const startDate = form.data.subject_start_dates[subject];
                                        const endDate = form.data.subject_end_dates[subject];

                                        return (
                                            <div key={`${subject}-${subjectsKey}`} className="overflow-hidden border rounded-xl bg-card shadow-sm group hover:border-primary/30 transition-all">
                                                <div className="flex items-center justify-between p-4 bg-muted/20 border-b">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm border">
                                                            <BookOpen className="w-4 h-4 text-primary" />
                                                        </div>
                                                        <span className="font-bold text-lg">{subject}</span>
                                                        {getDayCount(subject) !== null && (
                                                            <Badge variant="secondary" className="text-xs font-medium">
                                                                <CalendarDays className="w-3 h-3 mr-1" />
                                                                {getDayCount(subject)} days
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => removeSubject(subject)}
                                                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                    >
                                                        <X className="w-5 h-5" />
                                                    </Button>
                                                </div>

                                                <div className="p-4 space-y-6">
                                                    {/* Row 1: Difficulty and Dates */}
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                        {/* Column 1: Difficulty */}
                                                        <div className="space-y-4">
                                                            <div className="space-y-1.5">
                                                                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Difficulty</Label>
                                                                <Select
                                                                    value={form.data.subject_difficulties[subject]?.toString() || '2'}
                                                                    onValueChange={(val) => form.setData('subject_difficulties', { ...form.data.subject_difficulties, [subject]: parseInt(val) })}
                                                                >
                                                                    <SelectTrigger className="w-full">
                                                                        <SelectValue placeholder="Select difficulty" />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="1">🌱 Easy</SelectItem>
                                                                        <SelectItem value="2">🔥 Medium</SelectItem>
                                                                        <SelectItem value="3">⚡ Hard</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        </div>

                                                        {/* Column 2: Learning dates */}
                                                        <div className="space-y-4">
                                                            <div className="space-y-1.5">
                                                                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold text-emerald-600 dark:text-emerald-400">Start Learning <span className="text-rose-500">*</span></Label>
                                                                <DatePicker
                                                                    value={startDate || null}
                                                                    placeholder="Pick a date"
                                                                    onChange={(val) => form.setData('subject_start_dates', { ...form.data.subject_start_dates, [subject]: val || '' })}
                                                                />
                                                                <InputError message={startError} />
                                                            </div>
                                                            <div className="space-y-1.5">
                                                                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold text-rose-600 dark:text-rose-400">Stop Learning <span className="text-rose-500">*</span></Label>
                                                                <DatePicker
                                                                    value={endDate || null}
                                                                    placeholder="Pick a date"
                                                                    onChange={(val) => form.setData('subject_end_dates', { ...form.data.subject_end_dates, [subject]: val || '' })}
                                                                />
                                                                <InputError message={endError} />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Row 2: Session Durations */}
                                                    <div className="space-y-4 p-3 bg-muted/50 rounded-lg relative">
                                                        <div className="flex items-center justify-between">
                                                            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Session Mix</Label>
                                                            {!(duration?.min || duration?.max) && (
                                                                <Badge variant="outline" className="text-[10px] h-4">Optional</Badge>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <Select
                                                                value={duration?.min?.toString() || ''}
                                                                onValueChange={(value) =>
                                                                    form.setData('subject_session_durations', {
                                                                        ...form.data.subject_session_durations,
                                                                        [subject]: {
                                                                            ...form.data.subject_session_durations?.[subject],
                                                                            min: parseInt(value),
                                                                            max: Math.max(form.data.subject_session_durations?.[subject]?.max || 60, parseInt(value)),
                                                                        },
                                                                    })
                                                                }
                                                            >
                                                                <SelectTrigger className="h-8 text-xs">
                                                                    <SelectValue placeholder="Min" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {[15, 30, 45, 60].map(m => (
                                                                        <SelectItem key={m} value={m.toString()}>
                                                                            {formatDuration(m)}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                            <span className="text-xs text-muted-foreground">—</span>
                                                            <Select
                                                                value={duration?.max?.toString() || ''}
                                                                onValueChange={(value) =>
                                                                    form.setData('subject_session_durations', {
                                                                        ...form.data.subject_session_durations,
                                                                        [subject]: {
                                                                            ...form.data.subject_session_durations?.[subject],
                                                                            min: Math.min(form.data.subject_session_durations?.[subject]?.min || 30, parseInt(value)),
                                                                            max: parseInt(value),
                                                                        },
                                                                    })
                                                                }
                                                            >
                                                                <SelectTrigger className="h-8 text-xs">
                                                                    <SelectValue placeholder="Max" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {[30, 45, 60, 90, 120, 150, 180, 210, 240].map(m => (
                                                                        <SelectItem key={m} value={m.toString()}>
                                                                            {formatDuration(m)}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        {(duration?.min || duration?.max) && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const newPrefs = { ...form.data.subject_session_durations };
                                                                    delete newPrefs[subject];
                                                                    form.setData('subject_session_durations', newPrefs);
                                                                }}
                                                                className="absolute top-2.5 right-2.5 p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors"
                                                                title="Clear custom durations"
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        <p className="text-[10px] text-muted-foreground italic">
                                                            {duration?.min || duration?.max
                                                                ? `${formatDuration(duration?.min || 30)} - ${formatDuration(duration?.max || 60)}`
                                                                : "AI decides (based on your goal)"}
                                                        </p>
                                                    </div>
                                                    <InputError message={(form.errors as Record<string, string | undefined>).subject_dates} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-2xl">
                                    <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                    <p className="font-medium">Search for a subject above to get started</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Form Actions */}
                    <div className="pt-4 border-t">
                        <div className="flex items-center justify-end">
                            <Button
                                type="submit"
                                className="bg-primary hover:bg-primary/90"
                                size="sm"
                                disabled={form.processing || subjectsMissingDates.length > 0}
                            >
                                {form.processing ? (
                                    <>
                                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                        {hasCoreChanges ? 'Generating...' : 'Saving...'}
                                    </>
                                ) : (
                                    <>
                                        {hasCoreChanges ? (
                                            <>
                                                <Brain className="w-4 h-4 mr-2" />
                                                Generate Schedule
                                            </>
                                        ) : (
                                            <>
                                                <SettingsIcon className="w-4 h-4 mr-2" />
                                                Save Preferences
                                            </>
                                        )}
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </form>

            </div>

            {/* Subject Removal Confirmation Dialog */}
            <Dialog open={!!subjectToRemove} onOpenChange={(open) => {
                if (!open) {
                    setSubjectToRemove(null);
                    setSubjectRemoveInfo(null);
                }
            }}>
                <DialogContent className="sm:max-w-md">
                    {subjectRemoveInfo && subjectRemoveInfo.completed_sessions_count > 0 ? (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                                    Wait! You've Made Progress! 🥺
                                </DialogTitle>
                                <DialogDescription className="pt-3 space-y-4">
                                    <p className="text-base text-foreground/90 leading-relaxed">
                                        {subjectRemoveInfo.completed_sessions_count <= 2 ? (
                                            <>
                                                You've already completed <strong className="text-foreground">{subjectRemoveInfo.completed_sessions_count} study session{subjectRemoveInfo.completed_sessions_count !== 1 ? 's' : ''}</strong> of {subjectToRemove}!
                                                Even one hour of focus is a huge win for your future self. 🌟
                                            </>
                                        ) : (
                                            <>
                                                You've already completed <strong className="text-foreground">{subjectRemoveInfo.current_day - 1} day{(subjectRemoveInfo.current_day - 1) !== 1 ? 's' : ''}</strong> and <strong>{subjectRemoveInfo.completed_sessions_count} sessions</strong> in <strong>{subjectToRemove}</strong>.
                                                All that effort is a building block for your future. 😢
                                            </>
                                        )}
                                    </p>
                                    <div className="p-4 rounded-lg bg-amber-500/5 border border-amber-500/20">
                                        <p className="text-sm italic text-amber-500/80">
                                            {subjectRemoveInfo.completed_sessions_count <= 2
                                                ? "\"The first steps are often the hardest. Your efforts so far are proof of your commitment.\" ✨"
                                                : "\"Every hour you've invested in learning is a building block for your future.\" 🌟"}
                                        </p>
                                    </div>
                                    <p className="text-sm font-medium text-foreground/80">
                                        Are you absolutely sure you want to remove <strong>{subjectToRemove}</strong>?
                                    </p>

                                    <div className="flex items-start space-x-3 p-3 mt-4 rounded-md bg-destructive/5 border border-destructive/10">
                                        <Checkbox
                                            id="purge-history-onboarding"
                                            checked={purgeHistory}
                                            onCheckedChange={(checked) => setPurgeHistory(!!checked)}
                                            className="mt-1"
                                        />
                                        <div className="grid gap-1.5 leading-none">
                                            <Label
                                                htmlFor="purge-history-onboarding"
                                                className="text-sm font-semibold text-destructive cursor-pointer"
                                            >
                                                Permanently delete all historical progress
                                            </Label>
                                            <p className="text-xs text-muted-foreground">
                                                By default, we keep your XP and completed sessions. Check this to wipe everything for this subject.
                                                <span className="font-bold text-destructive/80"> This cannot be undone.</span>
                                            </p>
                                        </div>
                                    </div>
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter className="gap-2 sm:gap-0">
                                <Button variant="outline" onClick={() => {
                                    setSubjectToRemove(null);
                                    setSubjectRemoveInfo(null);
                                    setPurgeHistory(false);
                                }}>
                                    Keep Studying 💪
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={() => subjectToRemove && doRemoveSubject(subjectToRemove)}
                                >
                                    {purgeHistory ? "Purge & Remove 🚮" : "Remove Anyway 😔"}
                                </Button>
                            </DialogFooter>
                        </>
                    ) : (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <AlertTriangle className="w-5 h-5 text-muted-foreground" />
                                    Remove Subject
                                </DialogTitle>
                                <DialogDescription className="pt-3">
                                    Are you sure you want to remove <strong>{subjectToRemove}</strong> from your study plan? You haven't started any sessions yet, so no progress will be lost.
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter className="gap-2 sm:gap-0">
                                <Button variant="outline" onClick={() => {
                                    setSubjectToRemove(null);
                                    setSubjectRemoveInfo(null);
                                }}>
                                    Cancel
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={() => subjectToRemove && doRemoveSubject(subjectToRemove)}
                                >
                                    Remove Subject
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
