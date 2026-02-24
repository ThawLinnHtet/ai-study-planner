import { Head, useForm, router, usePage } from '@inertiajs/react';
import { X, BookOpen, Brain, CalendarDays, CheckCircle2, Clock, Compass, Target, Timer, Star, Sparkles, AlertTriangle, Lightbulb } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SimpleAutocomplete } from '@/components/ui/simple-autocomplete';
import { useSimpleSubjects } from '@/hooks/useSimpleSubjects';
import OnboardingLayout from '@/layouts/onboarding-layout';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { SharedData } from '@/types';

type OnboardingData = {
    subjects: string[];
    daily_study_hours: number | null;
    study_goal: string | null;
    timezone: string | null;
    subject_difficulties?: Record<string, number> | null;
    subject_session_durations?: Record<string, { min: number; max: number }> | null;
    subject_start_dates?: Record<string, string | null>;
    subject_end_dates?: Record<string, string | null>;
};

type Props = {
    step: number;
    totalSteps: number;
    onboarding: OnboardingData;
};

type WizardForm = {
    step: number;
    subjects: string[];
    daily_study_hours: number | '';
    subject_difficulties: Record<string, number>;
    subject_session_durations: Record<string, { min: number; max: number }>;
    subject_start_dates: Record<string, string | null>;
    subject_end_dates: Record<string, string | null>;
    study_goal: string;
    timezone: string;
    confirm: boolean;
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
    const { flash } = usePage<SharedData>().props;
    const warning = flash?.onboarding_warning as { title: string; message: string | string[]; recommendations: string[] } | undefined;

    const formatDuration = (min: number) => {
        if (!min) return '';
        if (min < 60) return `${min} min`;
        const hours = Math.floor(min / 60);
        const remainingMin = min % 60;
        return remainingMin === 0 ? `${hours}h` : `${hours}h ${remainingMin}min`;
    };

    const form = useForm<WizardForm>({
        step,
        subjects: onboarding.subjects ?? [],
        daily_study_hours: onboarding.daily_study_hours ?? 2,
        subject_difficulties: onboarding.subject_difficulties ?? {},
        subject_session_durations: onboarding.subject_session_durations ?? {},
        subject_start_dates: onboarding.subject_start_dates ?? {},
        subject_end_dates: onboarding.subject_end_dates ?? {},
        study_goal: onboarding.study_goal ?? '',
        timezone: onboarding.timezone || (Intl.DateTimeFormat().resolvedOptions().timeZone === 'Asia/Rangoon' ? 'Asia/Yangon' : Intl.DateTimeFormat().resolvedOptions().timeZone),
        confirm: false,
    });

    const [isProcessing, setIsProcessing] = useState(false);
    const [processingMessage, setProcessingMessage] = useState('');
    const [subjectInputValue, setSubjectInputValue] = useState('');

    useEffect(() => {
        form.setData('step', step);
    }, [step]);

    useEffect(() => {
        if (form.data.timezone === 'Asia/Rangoon') {
            form.setData('timezone', 'Asia/Yangon');
        }
    }, [form.data.timezone]);


    const { allSubjects, addCustomSubject, useSearchSuggestions } = useSimpleSubjects();
    const { data: searchData } = useSearchSuggestions(subjectInputValue);
    const suggestions = searchData?.subjects || [];

    const subjectsMissingDates = useMemo(() => {
        const startDates = form.data.subject_start_dates || {};
        const endDates = form.data.subject_end_dates || {};
        return form.data.subjects.filter((subject) => !startDates[subject] || !endDates[subject]);
    }, [form.data.subjects, form.data.subject_start_dates, form.data.subject_end_dates]);
    const hasMissingDates = subjectsMissingDates.length > 0;

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

    const addSubject = async (subjectName: string) => {
        if (!form.data.subjects.includes(subjectName)) {
            const predefinedSubjects = allSubjects || [];
            const isCustomSubject = !predefinedSubjects.includes(subjectName);

            const newSubjects = [...form.data.subjects, subjectName];
            const newDifficulties = {
                ...form.data.subject_difficulties,
                [subjectName]: 2,
            };

            form.setData('subjects', newSubjects);
            form.setData('subject_difficulties', newDifficulties);
            setSubjectInputValue('');

            if (isCustomSubject) {
                addCustomSubject(subjectName).catch(() => { });
            }
        }
    };

    const removeSubject = (subjectName: string) => {
        if (!form.data.subjects.includes(subjectName)) {
            return;
        }

        const newSubjects = form.data.subjects.filter((s) => s !== subjectName);
        const newDifficulties = { ...form.data.subject_difficulties };
        delete newDifficulties[subjectName];

        form.setData('subjects', newSubjects);
        form.setData('subject_difficulties', newDifficulties);

        if (subjectInputValue === subjectName) {
            setSubjectInputValue('');
        }
    };

    const clearAllSubjects = () => {
        form.setData('subjects', []);
        setSubjectInputValue('');
    };

    const canGoBack = step > 1;
    const backHref = `/onboarding?step=${Math.max(1, step - 1)}`;

    function next() {
        if (step === 2 && hasMissingDates) {
            return;
        }

        if (step === totalSteps) {
            // Ensure all subjects have default difficulties
            const finalDifficulties = { ...form.data.subject_difficulties };
            if (Array.isArray(form.data.subject_difficulties)) {
                Object.keys(finalDifficulties).forEach(k => delete finalDifficulties[k]);
            }
            form.data.subjects.forEach((subject: string) => {
                if (!finalDifficulties[subject]) {
                    finalDifficulties[subject] = 2;
                }
            });

            if (!form.data.confirm) {
                router.post('/onboarding', {
                    ...form.data,
                    step: totalSteps,
                    subject_difficulties: finalDifficulties,
                }, {
                    preserveScroll: true,
                });
                return;
            }

            setIsProcessing(true);
            const messages = [
                "Analyzing subject difficulty...",
                "Mapping your study dates...",
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
                    router.post('/onboarding', {
                        ...form.data,
                        step: totalSteps,
                        subject_difficulties: finalDifficulties,
                    }, {
                        onError: () => setIsProcessing(false),
                    });
                }
            }, 800);
            return;
        }

        // Submit the current step so the backend processes this step,
        // then rely on the redirect to advance to the next step.
        console.log(`[Onboarding] Submitting step ${step}`, {
            subjects: form.data.subjects,
            subject_session_durations: form.data.subject_session_durations,
        });
        router.post('/onboarding', {
            ...form.data,
            step,
        }, {
            preserveScroll: true,
        });
    }


    return (
        <>
            <Head title="Onboarding - Study Planner" />
            <OnboardingLayout>
                <div className="mx-auto w-full max-w-4xl p-4 md:p-8 text-foreground/90">
                    <div className="space-y-6">
                        <div className="space-y-4">
                            <Heading
                                title="Your Continuous Study Schedule"
                                description="A personalized Learning Path crafted by Neuron AI based on your long-term goals."
                            />
                            <ProgressBar step={step} totalSteps={totalSteps} />
                        </div>

                        <div className="flex justify-center">
                            <div className="w-full max-w-2xl space-y-6">

                                {warning && (
                                    <Alert className="border-amber-200 bg-amber-50 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
                                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                                        <div className="ml-3">
                                            <AlertTitle className="text-amber-800 font-bold flex items-center gap-2">
                                                {warning.title}
                                            </AlertTitle>
                                            <AlertDescription className="text-amber-700 mt-1 leading-relaxed">
                                                {Array.isArray(warning.message) ? (
                                                    <ul className="list-disc list-inside space-y-1">
                                                        {warning.message.map((msg, idx) => (
                                                            <li key={idx}>{msg}</li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    warning.message
                                                )}

                                                {warning.recommendations && warning.recommendations.length > 0 && (
                                                    <div className="mt-3 bg-white/60 rounded-lg p-3 border border-amber-200 shadow-sm">
                                                        <div className="flex items-center gap-1.5 text-xs font-bold mb-2 text-amber-900 uppercase tracking-wider">
                                                            <Lightbulb className="size-3 text-amber-600" />
                                                            Assistant Recommendations:
                                                        </div>
                                                        <ul className="space-y-1.5 text-sm">
                                                            {warning.recommendations.map((rec, idx) => (
                                                                <li key={idx} className="flex items-start gap-2">
                                                                    <span className="mt-1.5 h-1 w-1 rounded-full bg-amber-500 shrink-0" />
                                                                    {rec}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </AlertDescription>
                                        </div>
                                    </Alert>
                                )}

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
                                                    {[0, 1, 2].map((i) => (
                                                        <div key={i} className="size-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <CardContent className="space-y-6">
                                        {/* STEP 1: Subjects + Daily Hours + Study Goal */}
                                        {step === 1 ? (
                                            <div className="space-y-6">
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <BookOpen className="size-5" />
                                                        <h3 className="text-lg font-semibold">
                                                            Getting started
                                                        </h3>
                                                    </div>
                                                    <p className="text-sm text-muted-foreground">
                                                        Tell us about your subjects, daily study time, and goals
                                                    </p>
                                                </div>

                                                {/* Subjects */}
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <Label className="text-sm font-medium">Select your subjects</Label>
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
                                                        onClearAll={clearAllSubjects}
                                                        disabled={form.data.subjects.length >= 6}
                                                        placeholder={
                                                            form.data.subjects.length >= 6
                                                                ? "Limit reached (6/6)"
                                                                : form.data.subjects.length === 0
                                                                    ? "Type to search subjects (e.g., Mathematics, Physics)..."
                                                                    : "Add more subjects..."
                                                        }
                                                        className="w-full"
                                                    />
                                                    {form.data.subjects.length >= 6 && (
                                                        <p className="text-[10px] text-destructive font-bold flex items-center gap-1.5 px-1 animate-pulse">
                                                            <AlertTriangle className="size-3" />
                                                            "Focus Six" reached! Specialized depth is better than spreading too thin.
                                                        </p>
                                                    )}
                                                    {form.data.subjects.length > 0 && (
                                                        <div className="flex flex-wrap gap-2">
                                                            {form.data.subjects.map((subject) => (
                                                                <Badge
                                                                    key={subject}
                                                                    variant="secondary"
                                                                    className="flex items-center gap-1 px-3 py-1"
                                                                >
                                                                    <span>{subject}</span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => removeSubject(subject)}
                                                                        className="ml-1 text-red-500 hover:text-red-700"
                                                                    >
                                                                        <X className="h-3 w-3" />
                                                                    </button>
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    )}
                                                    <InputError message={typeof form.errors.subjects === 'string' ? form.errors.subjects : undefined} />
                                                </div>

                                                {/* Daily Study Hours */}
                                                <div className="space-y-3">
                                                    <Label htmlFor="daily_study_hours" className="text-sm font-medium">
                                                        Daily study hours
                                                    </Label>
                                                    <Select
                                                        value={form.data.daily_study_hours?.toString() || '2'}
                                                        onValueChange={(value) =>
                                                            form.setData('daily_study_hours', Number(value))
                                                        }
                                                    >
                                                        <SelectTrigger className="w-32">
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
                                                    <InputError message={form.errors.daily_study_hours} />
                                                </div>

                                                {/* Study Goal */}
                                                <div className="space-y-3">
                                                    <Label className="text-sm font-medium">Study goal</Label>
                                                    <div className="grid gap-3 md:grid-cols-2">
                                                        <ChoiceCard
                                                            title="Build strong foundation"
                                                            description="Focus on core concepts"
                                                            selected={form.data.study_goal === 'Build strong foundation'}
                                                            icon={<CheckCircle2 className="size-5" />}
                                                            onClick={() => form.setData('study_goal', 'Build strong foundation')}
                                                        />
                                                        <ChoiceCard
                                                            title="Achieve top performance"
                                                            description="Deep understanding & practice"
                                                            selected={form.data.study_goal === 'Achieve top performance'}
                                                            icon={<Target className="size-5" />}
                                                            onClick={() => form.setData('study_goal', 'Achieve top performance')}
                                                        />
                                                    </div>
                                                    <InputError message={form.errors.study_goal} />
                                                </div>

                                                <div className="flex items-center justify-end">
                                                    <Button
                                                        type="button"
                                                        disabled={form.processing || form.data.subjects.length === 0 || !form.data.study_goal}
                                                        onClick={next}
                                                    >
                                                        Next
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : null}

                                        {/* STEP 2: Subject Details (Exam dates, Start/End dates, Difficulty) */}
                                        {step === 2 ? (
                                            <div className="space-y-6">
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <CalendarDays className="size-5" />
                                                        <h3 className="text-lg font-semibold">
                                                            Subject details
                                                        </h3>
                                                    </div>
                                                    <p className="text-sm text-muted-foreground">
                                                        Set your study timeline and difficulty for each subject
                                                    </p>
                                                </div>

                                                <div className="space-y-4">
                                                    {form.data.subjects.map((subject) => {
                                                        const startValue = form.data.subject_start_dates[subject];
                                                        const endValue = form.data.subject_end_dates[subject];
                                                        const startError = (form.errors as Record<string, string | undefined>)[`subject_start_dates.${subject}`] || (!startValue ? 'Required' : undefined);
                                                        const endError = (form.errors as Record<string, string | undefined>)[`subject_end_dates.${subject}`] || (!endValue ? 'Required' : undefined);
                                                        return (
                                                            <div key={subject} className="p-4 rounded-xl border border-border bg-card/50 space-y-4">
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-2">
                                                                        <Label className="text-base font-semibold">{subject}</Label>
                                                                        {getDayCount(subject) !== null && (
                                                                            <Badge variant="secondary" className="text-xs font-medium">
                                                                                <CalendarDays className="size-3 mr-1" />
                                                                                {getDayCount(subject)} days
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                    <div className="space-y-1.5">
                                                                        <Label className="text-xs">Start Date <span className="text-rose-500 font-bold">*</span></Label>
                                                                        <DatePicker
                                                                            value={form.data.subject_start_dates[subject]}
                                                                            onChange={(value) =>
                                                                                form.setData('subject_start_dates', {
                                                                                    ...form.data.subject_start_dates,
                                                                                    [subject]: value,
                                                                                })
                                                                            }
                                                                            placeholder="Pick a date"
                                                                        />
                                                                        <InputError message={startError} />
                                                                    </div>
                                                                    <div className="space-y-1.5">
                                                                        <Label className="text-xs">End Date <span className="text-rose-500 font-bold">*</span></Label>
                                                                        <DatePicker
                                                                            value={form.data.subject_end_dates[subject]}
                                                                            onChange={(value) =>
                                                                                form.setData('subject_end_dates', {
                                                                                    ...form.data.subject_end_dates,
                                                                                    [subject]: value,
                                                                                })
                                                                            }
                                                                            placeholder="Pick a date"
                                                                        />
                                                                        <InputError message={endError} />
                                                                    </div>
                                                                </div>

                                                                <div className="space-y-2">
                                                                    <Label className="text-xs">Difficulty Level</Label>
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
                                                                                    {[0, 1, 2].map((i) => (
                                                                                        <Star key={i} className={cn(
                                                                                            "size-4",
                                                                                            i < opt.val ? (opt.val === 3 ? "fill-red-500 text-red-500" : opt.val === 2 ? "fill-amber-500 text-amber-500" : "fill-green-500 text-green-500") : "text-muted/20"
                                                                                        )} />
                                                                                    ))}
                                                                                </div>
                                                                                <span className="text-xs font-bold uppercase">{opt.label}</span>
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                <InputError
                                                    message={
                                                        (form.errors as Record<string, string | undefined>).subject_dates ||
                                                        (hasMissingDates
                                                            ? 'Set a start and end date for every subject to continue.'
                                                            : undefined)
                                                    }
                                                />

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
                                                        disabled={form.processing || (step === 2 && hasMissingDates)}
                                                        onClick={next}
                                                    >
                                                        Next
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : null}

                                        {/* STEP 3: Session Durations (Optional) + Timezone */}
                                        {step === 3 ? (
                                            <div className="space-y-6">
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <Timer className="size-5" />
                                                        <h3 className="text-lg font-semibold">
                                                            Preferences
                                                        </h3>
                                                    </div>
                                                    <p className="text-sm text-muted-foreground">
                                                        Optional: Customize session durations and set your timezone
                                                    </p>
                                                </div>

                                                {/* Session Durations */}
                                                <div className="space-y-3">
                                                    <Label className="text-sm font-medium">Session Duration <span className="text-xs font-normal text-muted-foreground">(Optional)</span></Label>
                                                    <p className="text-xs text-muted-foreground">
                                                        Set preferred session length per subject. Leave empty to let AI decide (up to your daily limit).
                                                    </p>
                                                    {form.data.subjects.map((subject) => {
                                                        const duration = form.data.subject_session_durations?.[subject];
                                                        const hasCustomDuration = duration?.min || duration?.max;
                                                        return (
                                                            <div key={`duration-${subject}`} className="flex items-center justify-between p-3 rounded-xl border border-border bg-card/50">
                                                                <div className="space-y-0.5">
                                                                    <Label className="text-sm font-semibold">{subject}</Label>
                                                                    <p className="text-xs text-muted-foreground">
                                                                        {hasCustomDuration ? `${formatDuration(duration?.min || 30)}-${formatDuration(duration?.max || 60)}` : `AI decides (based on your goal)`}
                                                                    </p>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="flex items-center gap-1.5">
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
                                                                            <SelectTrigger className="w-24">
                                                                                <SelectValue placeholder="Min" />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                {[15, 30, 45, 60, 75, 90].map((min) => (
                                                                                    <SelectItem key={min} value={min.toString()}>
                                                                                        {formatDuration(min)}
                                                                                    </SelectItem>
                                                                                ))}
                                                                            </SelectContent>
                                                                        </Select>
                                                                        <span className="text-sm text-muted-foreground">to</span>
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
                                                                            <SelectTrigger className="w-24">
                                                                                <SelectValue placeholder="Max" />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                {[15, 30, 45, 60, 75, 90, 120, 150, 180, 210, 240].map((max) => (
                                                                                    <SelectItem key={max} value={max.toString()}>
                                                                                        {formatDuration(max)}
                                                                                    </SelectItem>
                                                                                ))}
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>
                                                                    {hasCustomDuration && (
                                                                        <button
                                                                            type="button"
                                                                            className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                                                                            onClick={() => {
                                                                                const newDurations = { ...form.data.subject_session_durations };
                                                                                delete newDurations[subject];
                                                                                form.setData('subject_session_durations', newDurations);
                                                                            }}
                                                                        >
                                                                            <X className="size-4" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                {/* Timezone */}
                                                <div className="space-y-3">
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
                                                    <p className="text-xs text-muted-foreground">
                                                        <Compass className="size-3 inline mr-1" />
                                                        Helps us schedule reminders at the right local time
                                                    </p>
                                                    <InputError message={form.errors.timezone} />
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

                                        {/* STEP 4: Confirmation */}
                                        {step === 4 ? (
                                            <div className="space-y-6">
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <CheckCircle2 className="size-5" />
                                                        <h3 className="text-lg font-semibold">
                                                            Confirm & finish
                                                        </h3>
                                                    </div>
                                                    <p className="text-sm text-muted-foreground">
                                                        Review your details before we generate your personalized plan
                                                    </p>
                                                </div>

                                                <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3 text-sm">
                                                    <div className="font-medium">Summary</div>
                                                    <div className="text-muted-foreground space-y-2">
                                                        <div>
                                                            <span className="font-medium text-foreground">Subjects:</span>
                                                            <div className="mt-1 space-y-1 ml-2">
                                                                {form.data.subjects.map((subject) => {
                                                                    const days = getDayCount(subject);
                                                                    const start = form.data.subject_start_dates?.[subject];
                                                                    const end = form.data.subject_end_dates?.[subject];
                                                                    return (
                                                                        <div key={subject} className="flex items-center gap-2">
                                                                            <span className="text-foreground">{subject}</span>
                                                                            {days !== null && (
                                                                                <Badge variant="secondary" className="text-[10px] h-5">
                                                                                    {days} days
                                                                                </Badge>
                                                                            )}
                                                                            {start && end && (
                                                                                <span className="text-xs text-muted-foreground">
                                                                                    ({start} → {end})
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <span className="font-medium text-foreground">Daily hours:</span>{' '}
                                                            {form.data.daily_study_hours || '—'}
                                                        </div>
                                                        <div>
                                                            <span className="font-medium text-foreground">Goal:</span>{' '}
                                                            {form.data.study_goal || '—'}
                                                        </div>
                                                        <div>
                                                            <span className="font-medium text-foreground">Timezone:</span>{' '}
                                                            {form.data.timezone || '—'}
                                                        </div>
                                                    </div>
                                                </div>

                                                <label className="flex items-center gap-3">
                                                    <Checkbox
                                                        checked={form.data.confirm}
                                                        onCheckedChange={(v) =>
                                                            form.setData('confirm', v === true)
                                                        }
                                                    />
                                                    <span>I confirm these details are correct.</span>
                                                </label>
                                                <InputError message={form.errors.confirm} />

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
                                                        disabled={form.processing || !form.data.confirm}
                                                        onClick={next}
                                                    >
                                                        {form.processing ? 'Creating...' : 'Create My Plan'}
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
