import { Head, useForm } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import {
    BookOpen,
    Brain,
    CalendarDays,
    CheckCircle2,
    Clock,
    Compass,
    Eye,
    Hand,
    Headphones,
    Sparkles,
    X,
    Sun,
    Sunrise,
    Sunset,
    Moon,
    Star,
    Lightbulb,
    Target,
} from 'lucide-react';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import type { BreadcrumbItem } from '@/types';

type OnboardingData = {
    subjects: string[];
    exam_dates: Record<string, string | null>;
    daily_study_hours: number | null;
    learning_style: string | null;
    study_goal: string | null;
    timezone: string | null;
};

type Props = {
    step: number;
    totalSteps: number;
    onboarding: OnboardingData;
};

type WizardForm = {
    step: number;
    subjects: string[];
    exam_dates: Record<string, string | null>;
    daily_study_hours: number | '';
    productivity_peak: string;
    learning_style: string[];
    subject_difficulties: Record<string, number>;
    study_goal: string;
    timezone: string;
    confirm: boolean;
};

const breadcrumbs: BreadcrumbItem[] = [];

function ProgressBar({ step, totalSteps }: { step: number; totalSteps: number }) {
    const percentage = Math.round((step / totalSteps) * 100);

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                    Step {step} of {totalSteps}
                </span>
                <span>{percentage}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted">
                <div
                    className="h-2 rounded-full bg-primary transition-all"
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
}

function ChoiceCard({
    title,
    description,
    selected,
    icon,
    onClick,
}: {
    title: string;
    description?: string;
    selected: boolean;
    icon: React.ReactNode;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'group relative text-left',
                'rounded-xl border p-4 shadow-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]',
                selected
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border bg-card hover:border-primary/50 hover:bg-accent',
            )}
        >
            <div className="flex items-start gap-3">
                <div className={cn(
                    "mt-0.5 rounded-lg p-1.5 transition-colors",
                    selected ? "bg-primary text-primary-foreground" : "bg-muted text-foreground group-hover:bg-primary/10 group-hover:text-primary"
                )}>
                    {icon}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold">{title}</div>
                        {selected && (
                            <div className="bg-primary rounded-full p-0.5">
                                <CheckCircle2 className="size-3 text-primary-foreground" />
                            </div>
                        )}
                    </div>
                    {description ? (
                        <div className="mt-1 text-sm text-muted-foreground leading-snug">
                            {description}
                        </div>
                    ) : null}
                </div>
            </div>
        </button>
    );
}

export default function OnboardingWizard({ step, totalSteps, onboarding }: Props) {
    const form = useForm<WizardForm>({
        step,
        subjects: onboarding.subjects ?? [],
        exam_dates: onboarding.exam_dates ?? {},
        daily_study_hours: onboarding.daily_study_hours ?? 2,
        productivity_peak: (onboarding as any).productivity_peak ?? 'morning',
        learning_style: Array.isArray(onboarding.learning_style)
            ? onboarding.learning_style
            : (onboarding.learning_style ? [onboarding.learning_style] : []),
        subject_difficulties: (onboarding as any).subject_difficulties ?? {},
        study_goal: onboarding.study_goal ?? '',
        timezone: onboarding.timezone || (Intl.DateTimeFormat().resolvedOptions().timeZone === 'Asia/Rangoon' ? 'Asia/Yangon' : Intl.DateTimeFormat().resolvedOptions().timeZone),
        confirm: false,
    });

    const [customSubject, setCustomSubject] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingMessage, setProcessingMessage] = useState('');

    useEffect(() => {
        form.setData('step', step);
    }, [step]);

    useEffect(() => {
        if (form.data.timezone === 'Asia/Rangoon') {
            form.setData('timezone', 'Asia/Yangon');
        }
    }, [form.data.timezone]);

    const suggestedSubjects = useMemo(
        () => [
            'Math',
            'Physics',
            'Chemistry',
            'Biology',
            'English',
            'History',
            'Computer Science',
            'Economics',
        ],
        [],
    );

    const effectiveExamDates = useMemo(() => {
        const out: Record<string, string | null> = { ...form.data.exam_dates };

        for (const subject of form.data.subjects) {
            if (!(subject in out)) out[subject] = null;
        }

        for (const key of Object.keys(out)) {
            if (!form.data.subjects.includes(key)) {
                delete out[key];
            }
        }

        return out;
    }, [form.data.exam_dates, form.data.subjects]);

    useEffect(() => {
        if (
            JSON.stringify(Object.keys(effectiveExamDates).sort()) ===
            JSON.stringify(Object.keys(form.data.exam_dates).sort())
        ) {
            return;
        }

        form.setData('exam_dates', effectiveExamDates);
    }, [effectiveExamDates]);

    const canGoBack = step > 1;
    const backHref = `/onboarding?step=${Math.max(1, step - 1)}`;

    const breadcrumbs = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Onboarding', href: '/onboarding' },
    ];

    const neuronThoughts = {
        1: "Welcome! I'm Neuron. I'll be your study architect.",
        2: `You've selected ${form.data.subjects.length} subjects. A balanced load leads to better retention.`,
        3: Object.values(form.data.subject_difficulties).filter(v => v === 3).length > 0
            ? "Marking subjects as 'Hard' is brave! I'll give them more focus time."
            : "Setting exam dates helps me calculate your 'Study Velocity'.",
        4: form.data.productivity_peak === 'morning'
            ? "Morning person! We'll tackle 'deep work' when you're freshest."
            : "I'll align your schedule with your energy peaks.",
        5: "Last bit! Your learning style helps me pick the best study methods.",
        6: "Everything looks perfect. Ready to see your new schedule?"
    };

    function next() {
        if (step === totalSteps) {
            if (!form.data.confirm) {
                form.post('/onboarding', {
                    preserveScroll: true,
                });
                return;
            }

            setIsProcessing(true);
            const messages = [
                "Analyzing subject difficulty...",
                "Mapping exam dates...",
                "Optimizing for your peak energy...",
                "Configuring for your learning style...",
                "Neuron AI is crafting your plan..."
            ];

            let i = 0;
            const interval = setInterval(() => {
                if (i < messages.length) {
                    setProcessingMessage(messages[i]);
                    i++;
                } else {
                    clearInterval(interval);
                    form.post('/onboarding', {
                        onError: () => setIsProcessing(false)
                    });
                }
            }, 800);
            return;
        }

        form.transform((data) => {
            let finalSubjects = [...data.subjects];

            if (step === 2 && customSubject.trim()) {
                const trimmed = customSubject.trim();
                if (!finalSubjects.includes(trimmed)) {
                    finalSubjects.push(trimmed);
                }
            }

            return {
                ...data,
                subjects: finalSubjects,
            };
        });

        form.post('/onboarding', {
            preserveScroll: true,
            onSuccess: () => {
                if (step === 2) setCustomSubject('');
            },
        });
    }

    function toggleSubject(subject: string) {
        const exists = form.data.subjects.includes(subject);

        form.setData(
            'subjects',
            exists
                ? form.data.subjects.filter((s) => s !== subject)
                : [...form.data.subjects, subject],
        );
    }

    function toggleLearningStyle(style: string) {
        const exists = form.data.learning_style.includes(style);

        form.setData(
            'learning_style',
            exists
                ? form.data.learning_style.filter((s) => s !== style)
                : [...form.data.learning_style, style],
        );
    }

    function addCustomSubject() {
        const trimmed = customSubject.trim();
        if (!trimmed) return;

        // Validate: minimum 2 characters
        if (trimmed.length < 2) {
            return;
        }

        // Check for duplicates (case-insensitive)
        const lowerTrimmed = trimmed.toLowerCase();
        const isDuplicate = form.data.subjects.some(
            (s) => s.toLowerCase() === lowerTrimmed
        );

        if (!isDuplicate) {
            form.setData('subjects', [...form.data.subjects, trimmed]);
        }

        setCustomSubject('');
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Onboarding" />

            <div className="mx-auto w-full max-w-6xl p-4 md:p-8 text-foreground/90">
                <div className="space-y-6">
                    <div className="space-y-4">
                        <Heading
                            title="Let’s build your study plan"
                            description="A few quick questions so the AI can create a realistic schedule tailored to you."
                        />
                        <ProgressBar step={step} totalSteps={totalSteps} />
                    </div>

                    <div className="grid gap-6 md:grid-cols-[1fr_280px]">
                        <div className="space-y-6">

                            <Card className="relative overflow-hidden">
                                {isProcessing && (
                                    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm transition-all animate-in fade-in duration-500">
                                        <div className="space-y-6 text-center">
                                            <div className="flex justify-center">
                                                <div className="relative">
                                                    <Brain className="size-16 text-primary animate-pulse" />
                                                    <Sparkles className="absolute -top-1 -right-1 size-6 text-orange-400 animate-bounce" />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <h3 className="text-xl font-bold tracking-tight">Creating your plan...</h3>
                                                <p className="text-sm text-muted-foreground animate-pulse">{processingMessage}</p>
                                            </div>
                                            <div className="flex justify-center gap-1">
                                                {[...Array(3)].map((_, i) => (
                                                    <div key={i} className="size-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <CardContent className="space-y-6">
                                    {step === 1 ? (
                                        <div className="space-y-5">
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <Sparkles className="size-5" />
                                                    <h3 className="text-lg font-semibold">
                                                        Welcome
                                                    </h3>
                                                </div>
                                                <p className="text-sm text-muted-foreground">
                                                    This only takes 2–3 minutes. We’ll ask about your subjects,
                                                    deadlines, and available time so your plan stays achievable.
                                                </p>
                                            </div>

                                            <div className="grid gap-3">
                                                <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
                                                    <div className="flex items-start gap-3">
                                                        <CheckCircle2 className="mt-0.5 size-5" />
                                                        <div className="space-y-1">
                                                            <div className="font-medium">
                                                                Trust promise
                                                            </div>
                                                            <div className="text-muted-foreground">
                                                                We only use these answers to personalize your study plan.
                                                                You can change them later in Settings.
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <div />
                                                <Button
                                                    type="button"
                                                    disabled={form.processing}
                                                    onClick={next}
                                                >
                                                    Start
                                                </Button>
                                            </div>

                                            <InputError message={form.errors.step} />
                                        </div>
                                    ) : null}

                                    {step === 2 ? (
                                        <div className="space-y-6">
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <BookOpen className="size-5" />
                                                    <h3 className="text-lg font-semibold">
                                                        Select your subjects
                                                    </h3>
                                                </div>
                                                <p className="text-sm text-muted-foreground">
                                                    Choose what you’re studying. This helps the AI allocate time
                                                    per subject.
                                                </p>
                                            </div>

                                            <div className="grid gap-4">
                                                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                                                    {suggestedSubjects.map((subject) => {
                                                        const selected = form.data.subjects.includes(subject);
                                                        return (
                                                            <Button
                                                                key={subject}
                                                                type="button"
                                                                variant={selected ? 'default' : 'outline'}
                                                                onClick={() => toggleSubject(subject)}
                                                                className="justify-start truncate"
                                                                title={subject}
                                                            >
                                                                {subject}
                                                            </Button>
                                                        );
                                                    })}
                                                </div>

                                                {form.data.subjects.filter(s => !suggestedSubjects.includes(s)).length > 0 && (
                                                    <div className="space-y-2">
                                                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Custom subjects</Label>
                                                        <div className="flex flex-wrap gap-2">
                                                            {form.data.subjects
                                                                .filter(s => !suggestedSubjects.includes(s))
                                                                .map(subject => (
                                                                    <div key={subject} className="flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm font-medium text-primary">
                                                                        <span className="truncate max-w-[150px]">{subject}</span>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => toggleSubject(subject)}
                                                                            className="ml-1 rounded-full p-0.5 transition-colors hover:bg-primary/20 focus:outline-none"
                                                                        >
                                                                            <X className="size-3" />
                                                                        </button>
                                                                    </div>
                                                                ))
                                                            }
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="grid gap-2">
                                                    <Label htmlFor="custom_subject">
                                                        Add a custom subject
                                                    </Label>
                                                    <div className="flex gap-2">
                                                        <Input
                                                            id="custom_subject"
                                                            value={customSubject}
                                                            onChange={(e) =>
                                                                setCustomSubject(e.target.value)
                                                            }
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    addCustomSubject();
                                                                }
                                                            }}
                                                            placeholder="e.g. Organic Chemistry"
                                                        />
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            onClick={addCustomSubject}
                                                        >
                                                            Add
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
                                                <div className="flex items-start gap-3">
                                                    <Brain className="mt-0.5 size-5" />
                                                    <div className="space-y-1">
                                                        <div className="font-medium">
                                                            Why we ask
                                                        </div>
                                                        <div className="text-muted-foreground">
                                                            The planner balances subjects so you don’t over-focus on
                                                            just one.
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <InputError
                                                message={(form.errors as any).subjects}
                                            />

                                            <div className="flex items-center justify-between">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    asChild
                                                    disabled={!canGoBack}
                                                >
                                                    <a href={backHref}>Back</a>
                                                </Button>

                                                <Button
                                                    type="button"
                                                    disabled={form.processing}
                                                    onClick={next}
                                                >
                                                    Next
                                                </Button>
                                            </div>
                                        </div>
                                    ) : null}

                                    {step === 3 ? (
                                        <div className="space-y-6">
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <CalendarDays className="size-5" />
                                                    <h3 className="text-lg font-semibold">
                                                        Add exam dates
                                                    </h3>
                                                </div>
                                                <p className="text-sm text-muted-foreground">
                                                    Optional, but recommended. Deadlines help the AI prioritize.
                                                </p>
                                            </div>

                                            <div className="space-y-4">
                                                {form.data.subjects.map((subject) => (
                                                    <div key={subject} className="space-y-2">
                                                        <div className="flex flex-col gap-4 p-4 rounded-xl border border-border bg-card/50">
                                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                                <div className="space-y-1">
                                                                    <Label htmlFor={`subject-${subject}`} className="text-base font-semibold">
                                                                        {subject}
                                                                    </Label>
                                                                    <p className="text-xs text-muted-foreground">When is your exam?</p>
                                                                </div>
                                                                <div className="w-full md:w-[220px]">
                                                                    <DatePicker
                                                                        id={`subject-${subject}`}
                                                                        value={form.data.exam_dates[subject]}
                                                                        onChange={(value) =>
                                                                            form.setData('exam_dates', {
                                                                                ...form.data.exam_dates,
                                                                                [subject]: value,
                                                                            })
                                                                        }
                                                                        placeholder="Pick an exam date"
                                                                    />
                                                                </div>
                                                            </div>

                                                            <div className="space-y-2 pt-2 border-t border-border/50">
                                                                <Label className="text-xs font-medium text-muted-foreground uppercase">Difficulty Level</Label>
                                                                <div className="grid grid-cols-3 gap-2 max-w-sm">
                                                                    {[
                                                                        { val: 1, label: 'Easy', color: 'text-green-500' },
                                                                        { val: 2, label: 'Medium', color: 'text-amber-500' },
                                                                        { val: 3, label: 'Hard', color: 'text-red-500' }
                                                                    ].map((opt) => (
                                                                        <button
                                                                            key={opt.val}
                                                                            type="button"
                                                                            onClick={() => form.setData('subject_difficulties', {
                                                                                ...form.data.subject_difficulties,
                                                                                [subject]: opt.val
                                                                            })}
                                                                            className={cn(
                                                                                "flex flex-col items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl border transition-all",
                                                                                form.data.subject_difficulties[subject] === opt.val
                                                                                    ? "bg-primary/10 border-primary ring-1 ring-primary shadow-sm"
                                                                                    : "bg-background border-border hover:border-primary/50"
                                                                            )}
                                                                        >
                                                                            <div className="flex gap-0.5">
                                                                                {[...Array(3)].map((_, i) => (
                                                                                    <Star key={i} className={cn(
                                                                                        "size-4",
                                                                                        i < opt.val ? (opt.val === 3 ? "fill-red-500 text-red-500" : opt.val === 2 ? "fill-amber-500 text-amber-500" : "fill-green-500 text-green-500") : "text-muted/20"
                                                                                    )} />
                                                                                ))}
                                                                            </div>
                                                                            <span className="text-[10px] font-bold uppercase tracking-tighter">{opt.label}</span>
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <InputError
                                                            message={form.errors[`exam_dates.${subject}`] as string}
                                                        />
                                                        <InputError
                                                            message={form.errors[`subject_difficulties.${subject}`] as string}
                                                        />
                                                    </div>
                                                ))}

                                                <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
                                                    <div className="flex items-start gap-3">
                                                        <Target className="mt-0.5 size-5" />
                                                        <div className="space-y-1">
                                                            <div className="font-medium">
                                                                Why we ask
                                                            </div>
                                                            <div className="text-muted-foreground">
                                                                If two exams are close together, we’ll ramp up earlier.
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    asChild
                                                >
                                                    <a href={backHref}>Back</a>
                                                </Button>

                                                <Button
                                                    type="button"
                                                    disabled={form.processing}
                                                    onClick={next}
                                                >
                                                    Next
                                                </Button>
                                            </div>
                                        </div>
                                    ) : null}

                                    {step === 4 ? (
                                        <div className="space-y-6">
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <Clock className="size-5" />
                                                    <h3 className="text-lg font-semibold">
                                                        Daily study hours
                                                    </h3>
                                                </div>
                                                <p className="text-sm text-muted-foreground">
                                                    A realistic number helps the AI create a plan you can stick to.
                                                </p>
                                            </div>

                                            <div className="space-y-4">
                                                <div className="grid gap-2">
                                                    <Label htmlFor="daily_study_hours">
                                                        Hours per day
                                                    </Label>

                                                    <div className="flex items-center gap-3">
                                                        <input
                                                            id="daily_study_hours"
                                                            type="range"
                                                            min={1}
                                                            max={12}
                                                            value={
                                                                form.data.daily_study_hours ||
                                                                1
                                                            }
                                                            onChange={(e) =>
                                                                form.setData(
                                                                    'daily_study_hours',
                                                                    Number(
                                                                        e.target.value,
                                                                    ),
                                                                )
                                                            }
                                                            className="w-full"
                                                        />
                                                        <div className="w-16 text-right text-sm font-medium">
                                                            {form.data.daily_study_hours ||
                                                                1}
                                                        </div>
                                                    </div>

                                                    <InputError
                                                        message={
                                                            form.errors.daily_study_hours
                                                        }
                                                    />
                                                </div>

                                                <div className="space-y-4 pt-4 border-t border-border">
                                                    <div className="space-y-1">
                                                        <Label className="text-sm font-medium">When are you most focused?</Label>
                                                        <p className="text-xs text-muted-foreground">Neuron AI will schedule intense tasks during these hours.</p>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                                                        {[
                                                            { id: 'morning', label: 'Morning', icon: <Sunrise className="size-4" />, desc: '6am - 12pm' },
                                                            { id: 'afternoon', label: 'Afternoon', icon: <Sun className="size-4" />, desc: '12pm - 5pm' },
                                                            { id: 'evening', label: 'Evening', icon: <Sunset className="size-4" />, desc: '5pm - 9pm' },
                                                            { id: 'night', label: 'Night', icon: <Moon className="size-4" />, desc: '9pm - 2am' },
                                                        ].map((peak) => (
                                                            <button
                                                                key={peak.id}
                                                                type="button"
                                                                onClick={() => form.setData('productivity_peak', peak.id)}
                                                                className={cn(
                                                                    "flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all",
                                                                    form.data.productivity_peak === peak.id
                                                                        ? "bg-primary/10 border-primary ring-1 ring-primary shadow-sm"
                                                                        : "bg-background border-border hover:border-primary/50"
                                                                )}
                                                            >
                                                                <div className={cn(
                                                                    "p-1.5 rounded-lg",
                                                                    form.data.productivity_peak === peak.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                                                )}>
                                                                    {peak.icon}
                                                                </div>
                                                                <div className="text-center">
                                                                    <div className="text-xs font-bold">{peak.label}</div>
                                                                    <div className="text-[10px] text-muted-foreground">{peak.desc}</div>
                                                                </div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <InputError message={form.errors.productivity_peak} />
                                                </div>

                                                <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
                                                    <div className="flex items-start gap-3">
                                                        <Compass className="mt-0.5 size-5" />
                                                        <div className="space-y-1">
                                                            <div className="font-medium">
                                                                Why we ask
                                                            </div>
                                                            <div className="text-muted-foreground">
                                                                We’ll spread sessions across the week instead of cramming.
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    asChild
                                                >
                                                    <a href={backHref}>Back</a>
                                                </Button>

                                                <Button
                                                    type="button"
                                                    disabled={form.processing}
                                                    onClick={next}
                                                >
                                                    Next
                                                </Button>
                                            </div>
                                        </div>
                                    ) : null}

                                    {step === 5 ? (
                                        <div className="space-y-6">
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <Brain className="size-5" />
                                                    <h3 className="text-lg font-semibold">
                                                        Learning style & goal
                                                    </h3>
                                                </div>
                                                <p className="text-sm text-muted-foreground">
                                                    We tailor study sessions and reminders based on how you learn.
                                                </p>
                                            </div>

                                            <div className="space-y-8">
                                                <div className="space-y-4">
                                                    <div className="flex items-center justify-between">
                                                        <div className="text-sm font-medium">Learning style</div>
                                                        <div className="text-[10px] uppercase font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                                                            AI Personalization
                                                        </div>
                                                    </div>
                                                    <div className="grid gap-3 md:grid-cols-2">
                                                        <ChoiceCard
                                                            title="Visual"
                                                            description="Diagrams, videos, color coding"
                                                            selected={form.data.learning_style.includes('visual')}
                                                            icon={<Eye className="size-5" />}
                                                            onClick={() => toggleLearningStyle('visual')}
                                                        />
                                                        <ChoiceCard
                                                            title="Auditory"
                                                            description="Lectures, discussion, podcasts"
                                                            selected={form.data.learning_style.includes('auditory')}
                                                            icon={<Headphones className="size-5" />}
                                                            onClick={() => toggleLearningStyle('auditory')}
                                                        />
                                                        <ChoiceCard
                                                            title="Reading/Writing"
                                                            description="Notes, summaries, flashcards"
                                                            selected={form.data.learning_style.includes('reading')}
                                                            icon={<BookOpen className="size-5" />}
                                                            onClick={() => toggleLearningStyle('reading')}
                                                        />
                                                        <ChoiceCard
                                                            title="Kinesthetic"
                                                            description="Practice problems, hands-on"
                                                            selected={form.data.learning_style.includes('kinesthetic')}
                                                            icon={<Hand className="size-5" />}
                                                            onClick={() => toggleLearningStyle('kinesthetic')}
                                                        />
                                                    </div>
                                                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 px-1">
                                                        <Brain className="size-3 text-primary" />
                                                        Neuron AI will tailor study techniques to your style.
                                                    </p>
                                                    <InputError message={form.errors.learning_style} />
                                                </div>

                                                <div className="space-y-4">
                                                    <div className="text-sm font-medium">Study goal</div>
                                                    <div className="grid gap-3 md:grid-cols-2">
                                                        <ChoiceCard
                                                            title="Pass confidently"
                                                            description="Focus on fundamentals and consistency"
                                                            selected={form.data.study_goal === 'Pass confidently'}
                                                            icon={<CheckCircle2 className="size-5" />}
                                                            onClick={() => form.setData('study_goal', 'Pass confidently')}
                                                        />
                                                        <ChoiceCard
                                                            title="Get a top score"
                                                            description="More practice + higher intensity"
                                                            selected={form.data.study_goal === 'Get a top score'}
                                                            icon={<Target className="size-5" />}
                                                            onClick={() => form.setData('study_goal', 'Get a top score')}
                                                        />
                                                    </div>

                                                    <div className="space-y-2 pt-2">
                                                        <Label htmlFor="study_goal_custom" className="text-xs text-muted-foreground">
                                                            Or set a custom specific goal
                                                        </Label>
                                                        <Input
                                                            id="study_goal_custom"
                                                            value={form.data.study_goal}
                                                            onChange={(e) => form.setData('study_goal', e.target.value)}
                                                            placeholder="e.g. Finish syllabus 2 weeks before exam"
                                                            className="bg-muted/50 focus:bg-background transition-colors"
                                                        />
                                                        <InputError message={form.errors.study_goal} />
                                                    </div>
                                                </div>

                                                <div className="pt-4 border-t border-border">
                                                    <div className="grid gap-4 md:grid-cols-2 items-center">
                                                        <div className="space-y-2">
                                                            <Label htmlFor="timezone" className="text-sm font-medium">
                                                                Timezone
                                                            </Label>
                                                            <Input
                                                                id="timezone"
                                                                value={form.data.timezone}
                                                                onChange={(e) => form.setData('timezone', e.target.value)}
                                                                placeholder="Asia/Yangon"
                                                                className="bg-muted/30"
                                                            />
                                                            <InputError message={form.errors.timezone} />
                                                        </div>
                                                        <div className="rounded-lg bg-orange-500/5 border border-orange-500/10 p-3 flex gap-3 text-xs">
                                                            <Compass className="size-4 text-orange-500 shrink-0" />
                                                            <div className="text-muted-foreground leading-relaxed">
                                                                Timezone lets us schedule reminders at the right local time to avoid burnout.
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    asChild
                                                >
                                                    <a href={backHref}>Back</a>
                                                </Button>

                                                <Button
                                                    type="button"
                                                    disabled={form.processing}
                                                    onClick={next}
                                                >
                                                    Next
                                                </Button>
                                            </div>
                                        </div>
                                    ) : null}

                                    {step === 6 ? (
                                        <div className="space-y-6">
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <CheckCircle2 className="size-5" />
                                                    <h3 className="text-lg font-semibold">
                                                        Confirm & finish
                                                    </h3>
                                                </div>
                                                <p className="text-sm text-muted-foreground">
                                                    Review your details. When you submit, we’ll take you to your
                                                    dashboard.
                                                </p>
                                            </div>

                                            <div className="space-y-4 text-sm">
                                                <div className="rounded-lg border border-border bg-muted/30 p-4">
                                                    <div className="space-y-2">
                                                        <div className="font-medium">
                                                            Summary
                                                        </div>
                                                        <div className="text-muted-foreground">
                                                            <div>
                                                                <span className="font-medium text-foreground">
                                                                    Subjects:
                                                                </span>{' '}
                                                                {form.data.subjects.join(', ') ||
                                                                    '—'}
                                                            </div>
                                                            <div>
                                                                <span className="font-medium text-foreground">
                                                                    Daily hours:
                                                                </span>{' '}
                                                                {form.data.daily_study_hours || '—'}{' '}
                                                                <span className="text-muted-foreground">
                                                                    ({form.data.productivity_peak.charAt(0).toUpperCase() + form.data.productivity_peak.slice(1)} focus)
                                                                </span>
                                                            </div>
                                                            <div>
                                                                <span className="font-medium text-foreground">
                                                                    Learning style:
                                                                </span>{' '}
                                                                {form.data.learning_style.join(', ') ||
                                                                    '—'}
                                                            </div>
                                                            <div>
                                                                <span className="font-medium text-foreground">
                                                                    Goal:
                                                                </span>{' '}
                                                                {form.data.study_goal ||
                                                                    '—'}
                                                            </div>
                                                            <div>
                                                                <span className="font-medium text-foreground">
                                                                    Subject priorities:
                                                                </span>{' '}
                                                                {Object.values(form.data.subject_difficulties).filter(v => v === 3).length} Hard,{' '}
                                                                {Object.values(form.data.subject_difficulties).filter(v => v === 2).length} Medium
                                                            </div>
                                                            {Object.keys(form.data.exam_dates).length > 0 && (
                                                                <div>
                                                                    <span className="font-medium text-foreground">
                                                                        Exam dates:
                                                                    </span>{' '}
                                                                    {Object.entries(form.data.exam_dates)
                                                                        .filter(([_, date]) => date)
                                                                        .map(([subject, date]) => `${subject} (${date})`)
                                                                        .join(', ') || '—'}
                                                                </div>
                                                            )}
                                                            <div>
                                                                <span className="font-medium text-foreground">
                                                                    Timezone:
                                                                </span>{' '}
                                                                {form.data.timezone ||
                                                                    '—'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <label className="flex items-center gap-3">
                                                    <Checkbox
                                                        checked={form.data.confirm}
                                                        onCheckedChange={(v) =>
                                                            form.setData(
                                                                'confirm',
                                                                v === true,
                                                            )
                                                        }
                                                    />
                                                    <span>
                                                        I confirm these details are correct.
                                                    </span>
                                                </label>
                                                <InputError message={form.errors.confirm} />

                                                <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
                                                    <div className="flex items-start gap-3">
                                                        <Sparkles className="mt-0.5 size-5" />
                                                        <div className="space-y-1">
                                                            <div className="font-medium">
                                                                What happens next
                                                            </div>
                                                            <div className="text-muted-foreground">
                                                                You’ll land on the dashboard, then we can generate your first
                                                                plan.
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    asChild
                                                >
                                                    <a href={backHref}>Back</a>
                                                </Button>

                                                <Button
                                                    type="button"
                                                    disabled={form.processing}
                                                    onClick={next}
                                                >
                                                    Finish
                                                </Button>
                                            </div>
                                        </div>
                                    ) : null}
                                </CardContent>
                            </Card>
                        </div>

                        <div className="hidden md:block">
                            <div className="sticky top-8 space-y-4">
                                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 -mr-4 -mt-4 p-8 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-colors" />
                                    <div className="relative space-y-4">
                                        <div className="flex items-center gap-2 text-primary">
                                            <Brain className="size-5" />
                                            <span className="text-xs font-bold uppercase tracking-wider">Neuron Insight</span>
                                        </div>
                                        <p className="text-sm font-medium leading-relaxed italic text-foreground">
                                            "{neuronThoughts[step as keyof typeof neuronThoughts] || neuronThoughts[1]}"
                                        </p>
                                        <div className="pt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                                            <Sparkles className="size-3" />
                                            <span>Personalizing based on your answers</span>
                                        </div>
                                    </div>
                                </div>

                                {step >= 3 && form.data.subjects.length > 0 && (
                                    <div className="rounded-xl border border-border bg-card p-4 text-xs space-y-3 shadow-sm">
                                        <div className="flex items-center justify-between">
                                            <p className="font-semibold text-muted-foreground uppercase">Subject Load</p>
                                            <span className="text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                                                {form.data.subjects.length} Total
                                            </span>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center text-muted-foreground">
                                                <span>Hard</span>
                                                <span className="font-medium text-foreground">{Object.values(form.data.subject_difficulties).filter(v => v === 3).length}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-muted-foreground">
                                                <span>Medium</span>
                                                <span className="font-medium text-foreground">{Object.values(form.data.subject_difficulties).filter(v => v === 2).length}</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden flex">
                                                <div className="bg-red-500 h-full" style={{ width: `${(Object.values(form.data.subject_difficulties).filter(v => v === 3).length / form.data.subjects.length) * 100}%` }} />
                                                <div className="bg-amber-500 h-full" style={{ width: `${(Object.values(form.data.subject_difficulties).filter(v => v === 2).length / form.data.subjects.length) * 100}%` }} />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {step > 1 && (
                                    <div className="rounded-xl border border-border bg-card p-4 text-xs space-y-3 shadow-sm">
                                        <div className="flex items-center gap-2 text-amber-500">
                                            <Lightbulb className="size-3" />
                                            <p className="font-semibold uppercase">Pro Tip</p>
                                        </div>
                                        <p className="leading-relaxed text-muted-foreground italic">
                                            {step === 2 && "Adding specific subjects like 'Organic Chemistry' instead of just 'Science' helps me generate better summaries."}
                                            {step === 3 && "Don't worry if dates change - you can reschedule anytime from the dashboard."}
                                            {step === 4 && "Consistency is key. 1 hour every day is better than 7 hours once a week."}
                                            {step === 5 && "Visual learners benefit from mind maps, which I can generate for you later!"}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
