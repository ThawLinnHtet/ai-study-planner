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
    learning_style: string;
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
                'text-left',
                'rounded-xl border p-4 shadow-sm transition-colors',
                selected
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-card hover:bg-accent',
            )}
        >
            <div className="flex items-start gap-3">
                <div className="mt-0.5 text-foreground">{icon}</div>
                <div className="min-w-0">
                    <div className="font-medium">{title}</div>
                    {description ? (
                        <div className="text-sm text-muted-foreground">
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
        daily_study_hours: onboarding.daily_study_hours ?? '',
        learning_style: onboarding.learning_style ?? '',
        study_goal: onboarding.study_goal ?? '',
        timezone: onboarding.timezone ?? '',
        confirm: false,
    });

    const [customSubject, setCustomSubject] = useState('');

    useEffect(() => {
        form.setData('step', step);
    }, [step]);

    useEffect(() => {
        if (form.data.timezone) return;
        if (typeof window === 'undefined') return;

        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz) form.setData('timezone', tz);
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

    function next() {
        form.post('/onboarding', {
            preserveScroll: true,
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

    function addCustomSubject() {
        const trimmed = customSubject.trim();
        if (!trimmed) return;

        if (!form.data.subjects.includes(trimmed)) {
            form.setData('subjects', [...form.data.subjects, trimmed]);
        }

        setCustomSubject('');
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Onboarding" />

            <div className="mx-auto w-full max-w-3xl p-4 md:p-8">
                <div className="space-y-6">
                    <div className="space-y-4">
                        <Heading
                            title="Let’s build your study plan"
                            description="A few quick questions so the AI can create a realistic schedule tailored to you."
                        />
                        <ProgressBar step={step} totalSteps={totalSteps} />
                    </div>

                    <Card>
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

                                    <div className="grid gap-3">
                                        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                                            {suggestedSubjects.map((subject) => {
                                                const selected =
                                                    form.data.subjects.includes(subject);
                                                return (
                                                    <Button
                                                        key={subject}
                                                        type="button"
                                                        variant={
                                                            selected
                                                                ? 'default'
                                                                : 'outline'
                                                        }
                                                        onClick={() =>
                                                            toggleSubject(subject)
                                                        }
                                                        className="justify-start"
                                                    >
                                                        {subject}
                                                    </Button>
                                                );
                                            })}
                                        </div>

                                        <div className="grid gap-2">
                                            <Label htmlFor="custom_subject">
                                                Add a custom subject
                                            </Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    id="custom_subject"
                                                    value={customSubject}
                                                    onChange={(e) =>
                                                        setCustomSubject(
                                                            e.target.value,
                                                        )
                                                    }
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
                                            <div
                                                key={subject}
                                                className="grid gap-2"
                                            >
                                                <Label
                                                    htmlFor={`subject-${subject}`}
                                                >
                                                    {subject}
                                                </Label>
                                                <DatePicker
                                                    id={`subject-${subject}`}
                                                    value={
                                                        form.data.exam_dates[
                                                        subject
                                                        ]
                                                    }
                                                    onChange={(value) =>
                                                        form.setData('exam_dates', {
                                                            ...form.data.exam_dates,
                                                            [subject]: value,
                                                        })
                                                    }
                                                    placeholder="Pick an exam date"
                                                />
                                                <InputError
                                                    message={
                                                        (form.errors as any)
                                                            ?.exam_dates?.[subject]
                                                    }
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

                                    <div className="space-y-6">
                                        <div className="space-y-3">
                                            <div className="text-sm font-medium">
                                                Learning style
                                            </div>
                                            <div className="grid gap-3 md:grid-cols-2">
                                                <ChoiceCard
                                                    title="Visual"
                                                    description="Diagrams, mind maps, highlights"
                                                    selected={
                                                        form.data.learning_style ===
                                                        'visual'
                                                    }
                                                    icon={<Eye className="size-5" />}
                                                    onClick={() =>
                                                        form.setData(
                                                            'learning_style',
                                                            'visual',
                                                        )
                                                    }
                                                />
                                                <ChoiceCard
                                                    title="Auditory"
                                                    description="Lectures, talking it out"
                                                    selected={
                                                        form.data.learning_style ===
                                                        'auditory'
                                                    }
                                                    icon={
                                                        <Headphones className="size-5" />
                                                    }
                                                    onClick={() =>
                                                        form.setData(
                                                            'learning_style',
                                                            'auditory',
                                                        )
                                                    }
                                                />
                                                <ChoiceCard
                                                    title="Reading/Writing"
                                                    description="Notes, summaries, flashcards"
                                                    selected={
                                                        form.data.learning_style ===
                                                        'reading'
                                                    }
                                                    icon={<BookOpen className="size-5" />}
                                                    onClick={() =>
                                                        form.setData(
                                                            'learning_style',
                                                            'reading',
                                                        )
                                                    }
                                                />
                                                <ChoiceCard
                                                    title="Kinesthetic"
                                                    description="Practice problems, hands-on"
                                                    selected={
                                                        form.data.learning_style ===
                                                        'kinesthetic'
                                                    }
                                                    icon={<Hand className="size-5" />}
                                                    onClick={() =>
                                                        form.setData(
                                                            'learning_style',
                                                            'kinesthetic',
                                                        )
                                                    }
                                                />
                                            </div>
                                            <InputError
                                                message={form.errors.learning_style}
                                            />
                                        </div>

                                        <div className="space-y-3">
                                            <div className="text-sm font-medium">
                                                Study goal
                                            </div>
                                            <div className="grid gap-3 md:grid-cols-2">
                                                <ChoiceCard
                                                    title="Pass confidently"
                                                    description="Focus on fundamentals and consistency"
                                                    selected={
                                                        form.data.study_goal ===
                                                        'Pass confidently'
                                                    }
                                                    icon={<CheckCircle2 className="size-5" />}
                                                    onClick={() =>
                                                        form.setData(
                                                            'study_goal',
                                                            'Pass confidently',
                                                        )
                                                    }
                                                />
                                                <ChoiceCard
                                                    title="Get a top score"
                                                    description="More practice + review cycles"
                                                    selected={
                                                        form.data.study_goal ===
                                                        'Get a top score'
                                                    }
                                                    icon={<Target className="size-5" />}
                                                    onClick={() =>
                                                        form.setData(
                                                            'study_goal',
                                                            'Get a top score',
                                                        )
                                                    }
                                                />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="study_goal_custom">
                                                    Or write your own goal
                                                </Label>
                                                <Input
                                                    id="study_goal_custom"
                                                    value={form.data.study_goal}
                                                    onChange={(e) =>
                                                        form.setData(
                                                            'study_goal',
                                                            e.target.value,
                                                        )
                                                    }
                                                    placeholder="e.g. Finish syllabus 2 weeks early"
                                                />
                                                <InputError
                                                    message={form.errors.study_goal}
                                                />
                                            </div>
                                        </div>

                                        <div className="grid gap-2">
                                            <Label htmlFor="timezone">
                                                Timezone (optional)
                                            </Label>
                                            <Input
                                                id="timezone"
                                                value={form.data.timezone}
                                                onChange={(e) =>
                                                    form.setData(
                                                        'timezone',
                                                        e.target.value,
                                                    )
                                                }
                                                placeholder="Asia/Yangon"
                                            />
                                            <InputError message={form.errors.timezone} />
                                        </div>

                                        <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
                                            <div className="flex items-start gap-3">
                                                <CalendarDays className="mt-0.5 size-5" />
                                                <div className="space-y-1">
                                                    <div className="font-medium">
                                                        Why we ask
                                                    </div>
                                                    <div className="text-muted-foreground">
                                                        Timezone lets us schedule reminders at the right local time.
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
                                                        {form.data.daily_study_hours ||
                                                            '—'}
                                                    </div>
                                                    <div>
                                                        <span className="font-medium text-foreground">
                                                            Learning style:
                                                        </span>{' '}
                                                        {form.data.learning_style ||
                                                            '—'}
                                                    </div>
                                                    <div>
                                                        <span className="font-medium text-foreground">
                                                            Goal:
                                                        </span>{' '}
                                                        {form.data.study_goal ||
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
        </AppLayout>
    );
}
