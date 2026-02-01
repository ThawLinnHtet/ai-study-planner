import { Head, useForm } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import { X, BookOpen, Atom, Calculator, Globe, Briefcase, Palette, Stethoscope, Building, Gavel, Brain, CalendarDays, CheckCircle2, Clock, Compass, Eye, Hand, Headphones, Sparkles, Sun, Sunrise, Sunset, Moon, Star, Target } from 'lucide-react';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { SimpleAutocomplete } from '@/components/ui/simple-autocomplete';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import OnboardingLayout from '@/layouts/onboarding-layout';
import { cn } from '@/lib/utils';
import { useSimpleSubjects } from '@/hooks/useSimpleSubjects';

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

// Icon mapping for subjects
const iconMap: Record<string, any> = {
    'calculator': Calculator,
    'atom': Atom,
    'stethoscope': Stethoscope,
    'book-open': BookOpen,
    'globe': Globe,
    'briefcase': Briefcase,
    'palette': Palette,
    'building': Building,
    'gavel': Gavel,
    'brain': Brain,
};

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

    // Autocomplete state
    const [subjectInputValue, setSubjectInputValue] = useState('');

    useEffect(() => {
        form.setData('step', step);
    }, [step]);

    useEffect(() => {
        if (form.data.timezone === 'Asia/Rangoon') {
            form.setData('timezone', 'Asia/Yangon');
        }
    }, [form.data.timezone]);

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

    // Use the simplified subjects API hook
    const { suggestions, loading, searchSubjects, addCustomSubject } = useSimpleSubjects();

    // Search subjects when input changes
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            searchSubjects(subjectInputValue);
        }, 300); // Debounce search

        return () => clearTimeout(timeoutId);
    }, [subjectInputValue, searchSubjects]);

    const addSubject = async (subjectName: string) => {
        if (!form.data.subjects.includes(subjectName)) {
            const newSubjects = [...form.data.subjects, subjectName];
            form.setData('subjects', newSubjects);
        }
        setSubjectInputValue('');
    };

    const removeSubject = (subjectName: string) => {
        if (!form.data.subjects.includes(subjectName)) {
            return;
        }

        const newSubjects = form.data.subjects.filter((s) => s !== subjectName);
        form.setData('subjects', newSubjects);

        // Also clear the input if it matches the removed subject
        if (subjectInputValue === subjectName) {
            setSubjectInputValue('');
        }
    };

    const clearAllSubjects = () => {
        form.setData('subjects', []);
        setSubjectInputValue('');
    };

    const handleCustomSubject = async () => {
        const trimmed = subjectInputValue.trim();
        if (trimmed && !form.data.subjects.includes(trimmed)) {
            try {
                await addCustomSubject(trimmed);
                addSubject(trimmed);
            } catch (error) {
                console.error('Failed to add custom subject:', error);
                // Still add it locally even if API fails
                addSubject(trimmed);
            }
        }
    };

    const canGoBack = step > 1;
    const backHref = `/onboarding?step=${Math.max(1, step - 1)}`;

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

        form.setData('step', step + 1);

        form.post('/onboarding', {
            preserveScroll: true,
            onSuccess: () => {
                if (step === 2) setCustomSubject('');
            },
        });
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

    return (
        <>
            <Head title="Onboarding - Study Planner" />
            <OnboardingLayout>
                <div className="mx-auto w-full max-w-4xl p-4 md:p-8 text-foreground/90">
                    <div className="space-y-6">
                        <div className="space-y-4">
                            <Heading
                                title="Let’s build your study plan"
                                description="A few quick questions so the AI can create a realistic schedule tailored to you."
                            />
                            <ProgressBar step={step} totalSteps={totalSteps} />
                        </div>

                        <div className="flex justify-center">
                            <div className="w-full max-w-2xl space-y-6">

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
                                                        Search and select the subjects you want to study
                                                    </p>
                                                </div>

                                                {/* Simple Autocomplete Input */}
                                                <div className="relative">
                                                    <SimpleAutocomplete
                                                        value={subjectInputValue}
                                                        onValueChange={setSubjectInputValue}
                                                        onSelect={addSubject}
                                                        suggestions={suggestions}
                                                        selectedSubjects={form.data.subjects}
                                                        onRemoveSubject={removeSubject}
                                                        onClearAll={clearAllSubjects}
                                                        placeholder={
                                                            form.data.subjects.length === 0
                                                                ? "Type to search subjects (e.g., Mathematics, Physics, Chemistry)..."
                                                                : "Add more subjects or type custom ones..."
                                                        }
                                                        className="w-full"
                                                    />
                                                </div>

                                                {/* Selected Subjects */}
                                                {form.data.subjects.length > 0 && (
                                                    <Card>
                                                        <CardContent className="pt-6">
                                                            <div className="space-y-3">
                                                                <div className="flex items-center justify-between">
                                                                    <h3 className="text-sm font-medium text-muted-foreground">
                                                                        Selected Subjects
                                                                    </h3>
                                                                    <div className="text-xs text-blue-600 font-medium">
                                                                        {form.data.subjects.length} subject{form.data.subjects.length !== 1 ? 's' : ''} selected
                                                                    </div>
                                                                </div>
                                                                <div className="text-xs text-muted-foreground mb-2">
                                                                    {form.data.subjects.length === 0
                                                                        ? "Select 3-5 subjects for best results"
                                                                        : `Great! ${form.data.subjects.length === 1 ? 'Keep going' : form.data.subjects.length < 3 ? 'Add a few more' : 'Perfect selection'}`}
                                                                </div>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {form.data.subjects.map((subject) => (
                                                                        <Badge
                                                                            key={subject}
                                                                            variant="secondary"
                                                                            className="flex items-center gap-1 px-3 py-1 hover:bg-red-50 transition-all duration-200 transform hover:scale-105 shadow-sm hover:shadow-md"
                                                                        >
                                                                            <span>{subject}</span>
                                                                            <button
                                                                                type="button"
                                                                                onClick={(e) => {
                                                                                    e.preventDefault();
                                                                                    e.stopPropagation();
                                                                                    removeSubject(subject);
                                                                                }}
                                                                                className="ml-1 text-red-500 hover:text-red-700 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-red-500 rounded-full p-0.5 transition-all duration-200"
                                                                                title={`Remove ${subject}`}
                                                                            >
                                                                                <X className="h-3 w-3" />
                                                                            </button>
                                                                        </Badge>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                )}

                                                <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
                                                    <div className="flex items-start gap-3">
                                                        <Brain className="mt-0.5 size-5" />
                                                        <div className="space-y-1">
                                                            <div className="font-medium">
                                                                Why we ask
                                                            </div>
                                                            <div className="text-muted-foreground">
                                                                The planner balances subjects so you don't over-focus on
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
                        </div>
                    </div>
                </div>
            </OnboardingLayout>
        </>
    );
}
