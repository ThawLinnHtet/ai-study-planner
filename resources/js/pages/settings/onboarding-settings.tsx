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
    Target
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { toast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SimpleAutocomplete } from '@/components/ui/simple-autocomplete';
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
    exam_dates: Record<string, string | null>;
    subject_difficulties: Record<string, number>;
    subject_session_durations: Record<string, { min: number; max: number }>;
    daily_study_hours: number;
    productivity_peak: string;
    study_goal: string;
    timezone: string;
    onboarding_completed: boolean;
    onboarding_step: number;
}

interface Props {
    user: User;
    activePlan: unknown;
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
    hours_adjusted?: boolean;
    original_hours?: number;
    recommended_hours?: number;
}

export default function OnboardingSettings({ user }: Props) {
    const page = usePage<SharedData>();
    const flash = page.props.flash as OnboardingFlash;
    // Store original values to detect changes
    const originalValues = useRef({
        subjects: parseSubjects(user.subjects),
        exam_dates: user.exam_dates || {},
        subject_difficulties: user.subject_difficulties || {},
        subject_session_durations: user.subject_session_durations || {},
        daily_study_hours: user.daily_study_hours || 2,
        productivity_peak: user.productivity_peak || 'morning',
        study_goal: user.study_goal || '',
        timezone: user.timezone || '',
    });

    // Helper to check if any preference changed
    const hasPreferencesChanged = (): boolean => {
        const current = form.data;
        const original = originalValues.current;

        // Check subjects (array comparison)
        if (JSON.stringify(current.subjects.sort()) !== JSON.stringify(original.subjects.sort())) {
            return true;
        }

        // Check exam_dates (object comparison)
        if (JSON.stringify(current.exam_dates) !== JSON.stringify(original.exam_dates)) {
            return true;
        }

        // Check subject_difficulties
        if (JSON.stringify(current.subject_difficulties) !== JSON.stringify(original.subject_difficulties)) {
            return true;
        }

        // Check subject_session_durations
        if (JSON.stringify(current.subject_session_durations) !== JSON.stringify(original.subject_session_durations)) {
            return true;
        }

        // Check simple values
        if (current.daily_study_hours !== original.daily_study_hours) return true;
        if (current.productivity_peak !== original.productivity_peak) return true;
        if (current.study_goal !== original.study_goal) return true;
        if (current.timezone !== original.timezone) return true;

        return false;
    };
    // TanStack Query for subjects
    const { allSubjects, addCustomSubject, useSearchSuggestions } = useSimpleSubjects();
    const [subjectInputValue, setSubjectInputValue] = useState('');
    const [subjectsKey, setSubjectsKey] = useState(0); // Force re-render

    // Search suggestions hook
    const { data: searchData } = useSearchSuggestions(subjectInputValue);
    const suggestions = searchData?.subjects || [];

    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success);
        }

        if (flash?.error) {
            toast.error(flash.error);
        }
    }, [flash]);

    // Initialize form with fresh user data on every render
    const form = useForm({
        subjects: parseSubjects(user.subjects),
        exam_dates: user.exam_dates || {},
        subject_difficulties: user.subject_difficulties || {},
        subject_session_durations: user.subject_session_durations || {},
        daily_study_hours: user.daily_study_hours || 2,
        productivity_peak: user.productivity_peak || 'morning',
        study_goal: user.study_goal || '',
        timezone: user.timezone || '',
        regenerate_plan: false,
    });

    const addSubject = async (subjectName: string) => {
        if (!form.data.subjects.includes(subjectName)) {
            // Check if this is a custom subject (not in the dynamic subjects list)
            const predefinedSubjects = allSubjects || [];
            const isCustomSubject = !predefinedSubjects.includes(subjectName);

            // OPTIMISTIC UPDATE: Update UI immediately
            const newSubjects = [...form.data.subjects, subjectName];
            const newDifficulties = {
                ...form.data.subject_difficulties,
                [subjectName]: 2, // Default difficulty
            };

            // Update form data immediately
            form.setData('subjects', newSubjects);
            form.setData('subject_difficulties', newDifficulties);

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

    const removeSubject = (subject: string) => {
        const newSubjects = form.data.subjects.filter((s: string) => s !== subject);
        const newDifficulties = { ...form.data.subject_difficulties };
        delete newDifficulties[subject];

        form.setData('subjects', newSubjects);
        form.setData('subject_difficulties', newDifficulties);

        // Force re-render
        setSubjectsKey((prev) => prev + 1);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Only regenerate if preferences actually changed
        const shouldRegenerate = hasPreferencesChanged();

        // Manually create the data object with regenerate_plan set based on changes
        const submitData = {
            ...form.data,
            regenerate_plan: shouldRegenerate
        };

        // Use router.visit for direct submission with custom data
        router.put('/settings/onboarding', submitData, {
            onSuccess: () => {
                // Show toast after successful save, before redirect
                if (shouldRegenerate) {
                    toast.success('Study plan updated successfully!');
                }
                // Reset the flag after successful submission
                form.setData('regenerate_plan', false);
            },
            onError: (errors: Record<string, string>) => {
                toast.error('Failed to save preferences: ' + Object.values(errors).join(', '));
                // Reset the flag on error
                form.setData('regenerate_plan', false);
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

                {/* Success/Error Messages */}
                {flash?.hours_adjusted && (
                    <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                            <strong>Study hours adjusted:</strong> We adjusted your daily study hours from {flash?.original_hours} to {flash?.recommended_hours} hours for better focus and sustainability.
                        </AlertDescription>
                    </Alert>
                )}

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Subjects Section */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <BookOpen className="w-5 h-5" />
                                Subjects & Difficulty
                            </CardTitle>
                            <CardDescription>
                                Add subjects and set their difficulty levels for personalized scheduling
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Current Subjects */}
                            {form.data.subjects && form.data.subjects.length > 0 && (
                                <div className="space-y-3">
                                    <Label className="text-sm font-medium">Current Subjects</Label>
                                    <div className="grid gap-3">
                                        {form.data.subjects.map((subject: string) => (
                                            <div key={`${subject}-${subjectsKey}`} className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
                                                <span className="flex-1 font-medium">{subject}</span>
                                                <div className="flex items-center gap-2">
                                                    <Label className="text-xs text-muted-foreground">Difficulty:</Label>
                                                    <Select
                                                        value={form.data.subject_difficulties[subject]?.toString() || '2'}
                                                        onValueChange={(value) => updateSubjectDifficulty(subject, parseInt(value))}
                                                    >
                                                        <SelectTrigger className="w-28 h-8">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="1">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                                                    Easy
                                                                </div>
                                                            </SelectItem>
                                                            <SelectItem value="2">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                                                                    Medium
                                                                </div>
                                                            </SelectItem>
                                                            <SelectItem value="3">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                                                    Hard
                                                                </div>
                                                            </SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => removeSubject(subject)}
                                                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Add New Subject */}
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Add New Subject</Label>
                                <SimpleAutocomplete
                                    value={subjectInputValue}
                                    onValueChange={setSubjectInputValue}
                                    onSelect={addSubject}
                                    suggestions={suggestions}
                                    selectedSubjects={form.data.subjects}
                                    onRemoveSubject={removeSubject}
                                    placeholder="Type to search or add a subject..."
                                    className="w-full"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Start typing to search existing subjects or add a custom one
                                </p>
                                {form.errors.subjects && (
                                    <p className="text-sm text-destructive">{form.errors.subjects}</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Exam Dates Section */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <CalendarDays className="w-5 h-5" />
                                Exam Dates
                            </CardTitle>
                            <CardDescription>
                                Set exam dates for each subject to prioritize study time
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {form.data.subjects && form.data.subjects.length > 0 ? (
                                <div className="space-y-3">
                                    {form.data.subjects.map((subject: string) => (
                                        <div key={subject} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                                            <div className="flex items-center gap-3">
                                                <BookOpen className="w-4 h-4 text-muted-foreground" />
                                                <div>
                                                    <Label htmlFor={`exam-date-${subject}`} className="text-base font-semibold">
                                                        {subject}
                                                    </Label>
                                                    <p className="text-xs text-muted-foreground">When is your exam?</p>
                                                </div>
                                            </div>
                                            <div className="w-55">
                                                <DatePicker
                                                    id={`exam-date-${subject}`}
                                                    value={form.data.exam_dates?.[subject] || null}
                                                    onChange={(value) =>
                                                        form.setData('exam_dates', {
                                                            ...(form.data.exam_dates || {}),
                                                            [subject]: value,
                                                        })
                                                    }
                                                    placeholder="Pick an exam date"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-muted-foreground">
                                    <CalendarDays className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                    <p>Add subjects first to set their exam dates</p>
                                </div>
                            )}
                            {form.errors.exam_dates && (
                                <p className="text-sm text-destructive">{form.errors.exam_dates}</p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Session Duration Section (Optional) */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Timer className="w-5 h-5" />
                                Session Duration
                                <span className="text-xs font-normal text-muted-foreground ml-1">(Optional)</span>
                            </CardTitle>
                            <CardDescription>
                                Set preferred session length per subject. Leave empty to let AI decide automatically.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {form.data.subjects && form.data.subjects.length > 0 ? (
                                <div className="space-y-3">
                                    {form.data.subjects.map((subject: string) => {
                                        const duration = form.data.subject_session_durations?.[subject];
                                        const hasCustomDuration = duration?.min || duration?.max;
                                        return (
                                            <div key={subject} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                                                <div className="flex items-center gap-3">
                                                    <Timer className="w-4 h-4 text-muted-foreground" />
                                                    <div>
                                                        <Label className="text-base font-semibold">
                                                            {subject}
                                                        </Label>
                                                        <p className="text-xs text-muted-foreground">
                                                            {hasCustomDuration ? `${duration?.min || 30}-${duration?.max || 60} min` : 'AI decides (30-90 min)'}
                                                        </p>
                                                    </div>
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
                                                                        {min} min
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
                                                                {[15, 30, 45, 60, 75, 90, 120].map((max) => (
                                                                    <SelectItem key={max} value={max.toString()}>
                                                                        {max} min
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    {hasCustomDuration && (
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                                            onClick={() => {
                                                                const newDurations = { ...form.data.subject_session_durations };
                                                                delete newDurations[subject];
                                                                form.setData('subject_session_durations', newDurations);
                                                            }}
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-muted-foreground">
                                    <Timer className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                    <p>Add subjects first to set session durations</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Study Schedule Section */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Clock className="w-5 h-5" />
                                Study Schedule
                            </CardTitle>
                            <CardDescription>
                                Configure your daily study hours and peak productivity times
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="daily_study_hours">Daily Study Hours</Label>
                                    <Select
                                        value={form.data.daily_study_hours.toString()}
                                        onValueChange={(value) => form.setData('daily_study_hours', parseInt(value))}
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
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Recommended: 2-6 hours for optimal learning
                                    </p>
                                </div>

                                <div>
                                    <Label className="text-sm font-medium">When are you most focused?</Label>
                                    <p className="text-xs text-muted-foreground mb-3">AI will schedule intense tasks during these hours.</p>

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
                                                className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all ${form.data.productivity_peak === peak.id
                                                    ? "bg-primary/10 border-primary ring-1 ring-primary shadow-sm"
                                                    : "bg-background border-border hover:border-primary/50"
                                                    }`}
                                            >
                                                <div className={`p-1.5 rounded-lg ${form.data.productivity_peak === peak.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                                    }`}>
                                                    {peak.icon}
                                                </div>
                                                <span className="text-xs font-medium">{peak.label}</span>
                                                <span className="text-xs text-muted-foreground">{peak.desc}</span>
                                            </button>
                                        ))}
                                    </div>
                                    {form.errors.productivity_peak && (
                                        <p className="text-sm text-destructive mt-2">{form.errors.productivity_peak}</p>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Study Goal Section */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Target className="w-5 h-5" />
                                Study Goal
                            </CardTitle>
                            <CardDescription>
                                What's your main objective? This helps set the right study intensity.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-4">
                                    <Label className="text-sm font-medium">Choose Your Goal</Label>
                                    <div className="space-y-2">
                                        {[
                                            { value: 'Build strong foundation', label: 'Build strong foundation', desc: 'Focus on core concepts and steady progress' },
                                            { value: 'Achieve top performance', label: 'Achieve top performance', desc: 'Deep understanding with intensive practice' }
                                        ].map((goal) => (
                                            <div key={goal.value} className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={goal.value}
                                                    checked={form.data.study_goal === goal.value}
                                                    onCheckedChange={(checked) => {
                                                        if (checked) {
                                                            form.setData('study_goal', goal.value);
                                                        } else {
                                                            form.setData('study_goal', '');
                                                        }
                                                    }}
                                                />
                                                <div className="flex-1">
                                                    <Label htmlFor={goal.value} className="text-sm font-medium">{goal.label}</Label>
                                                    <p className="text-xs text-muted-foreground">{goal.desc}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {form.errors.study_goal && (
                                        <p className="text-sm text-destructive">{form.errors.study_goal}</p>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <Label htmlFor="timezone">Timezone</Label>
                                        <Input
                                            id="timezone"
                                            value={form.data.timezone}
                                            onChange={(e) => form.setData('timezone', e.target.value)}
                                            placeholder="e.g., Asia/Yangon"
                                        />
                                        {form.errors.timezone && (
                                            <p className="text-sm text-destructive">{form.errors.timezone}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Hidden field for plan regeneration */}
                    <input
                        type="hidden"
                        name="regenerate_plan"
                        value={form.data.regenerate_plan ? '1' : '0'}
                    />

                    {/* Form Actions */}
                    <div className="pt-4 border-t">
                        <div className="flex items-center justify-end">
                            <Button
                                type="submit"
                                className="bg-primary hover:bg-primary/90"
                                size="sm"
                            >
                                <Brain className="w-4 h-4 mr-2" />
                                Generate Schedule
                            </Button>
                        </div>
                    </div>
                </form>

            </div>
        </AppLayout>
    );
}
