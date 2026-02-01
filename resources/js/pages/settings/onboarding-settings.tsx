import { Head, useForm, usePage } from '@inertiajs/react';
import React, { useState, useEffect } from 'react';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SimpleAutocomplete } from '@/components/ui/simple-autocomplete';
import { useSimpleSubjects } from '@/hooks/useSimpleSubjects';
import { AlertTriangle, Info, Settings, RotateCcw, Save } from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { toast } from '@/hooks/use-toast';
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

const learningStyles = [
    { value: 'visual', label: 'Visual (Diagrams, charts, videos)' },
    { value: 'auditory', label: 'Auditory (Lectures, discussions)' },
    { value: 'reading', label: 'Reading (Textbooks, articles)' },
    { value: 'kinesthetic', label: 'Kinesthetic (Hands-on, practice)' },
];

const peakTimes = [
    { value: 'morning', label: 'Morning (6AM - 12PM)' },
    { value: 'afternoon', label: 'Afternoon (12PM - 5PM)' },
    { value: 'evening', label: 'Evening (5PM - 9PM)' },
    { value: 'night', label: 'Night (9PM - 2AM)' },
];

const commonSubjects = [
    'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science',
    'Programming', 'Web Development', 'Data Science', 'Machine Learning',
    'English', 'History', 'Geography', 'Economics', 'Psychology',
    'Philosophy', 'Art', 'Music', 'Languages', 'Business'
];

interface User {
    id: number;
    name: string;
    email: string;
    subjects: string[];
    exam_dates: string[];
    subject_difficulties: Record<string, number>;
    daily_study_hours: number;
    productivity_peak: string;
    learning_style: string[];
    study_goal: string;
    timezone: string;
    onboarding_completed: boolean;
    onboarding_step: number;
}

interface Props {
    user: User;
    activePlan: any;
}

export default function OnboardingSettings({ user, activePlan }: Props) {
    const page = usePage<SharedData>();
    const flash = page.props.flash;
    const [newSubject, setNewSubject] = useState('');
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [subjectsKey, setSubjectsKey] = useState(0); // Force re-render

    // Autocomplete hook for subject suggestions
    const { suggestions, loading, addCustomSubject } = useSimpleSubjects();
    const [subjectInputValue, setSubjectInputValue] = useState('');

    useEffect(() => {
        console.log('Flash data received:', flash);

        if (flash?.success) {
            toast.success(flash.success);
        }
        if (flash?.error) {
            toast.error(flash.error);
        }
        if (flash?.info) {
            toast.info(flash.info);
        }
    }, [flash]);

    // Initialize form with fresh user data on every render
    const form = useForm({
        subjects: Array.isArray(user.subjects) ? user.subjects : (typeof user.subjects === 'string' ? JSON.parse(user.subjects || '[]') : []),
        exam_dates: user.exam_dates || [],
        subject_difficulties: user.subject_difficulties || {},
        daily_study_hours: user.daily_study_hours || 2,
        productivity_peak: user.productivity_peak || 'morning',
        learning_style: user.learning_style || [],
        study_goal: user.study_goal || '',
        timezone: user.timezone || '',
        regenerate_plan: false,
    });

    // Reset form data when user data changes (after save)
    useEffect(() => {
        console.log('User data updated:', user);
        form.setData({
            subjects: Array.isArray(user.subjects) ? user.subjects : (typeof user.subjects === 'string' ? JSON.parse(user.subjects || '[]') : []),
            exam_dates: user.exam_dates || [],
            subject_difficulties: user.subject_difficulties || {},
            daily_study_hours: user.daily_study_hours || 2,
            productivity_peak: user.productivity_peak || 'morning',
            learning_style: user.learning_style || [],
            study_goal: user.study_goal || '',
            timezone: user.timezone || '',
            regenerate_plan: false,
        });
    }, [user]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        console.log('Submitting form data:', form.data);
        console.log('Subjects in form:', form.data.subjects);

        form.put('/settings/onboarding', {
            onError: (errors) => {
                console.log('Form errors:', errors);
                toast.error('Validation failed: ' + Object.values(errors).join(', '));
            },
            onSuccess: () => {
                console.log('Form submitted successfully');
                // Force a complete page reload to get fresh user data
                window.location.href = '/settings/onboarding';
            }
        });
    };

    const handleReset = () => {
        if (confirm('Are you sure you want to reset your onboarding? This will clear all your study preferences and deactivate your current study plan.')) {
            window.location.href = '/settings/onboarding/reset';
        }
    };

    const addSubject = async (subjectName: string) => {
        if (!form.data.subjects.includes(subjectName)) {
            // Check if this is a custom subject (not in the 60 predefined professional subjects)
            const predefinedSubjects = [
                'Artificial Intelligence', 'Data Science', 'Cybersecurity', 'Software Engineering',
                'Web Development', 'Mobile Development', 'UI/UX Design', 'Cloud Computing', 'DevOps',
                'Business Administration', 'Financial Analysis', 'Marketing', 'Accounting',
                'Project Management', 'Digital Marketing', 'Supply Chain Management', 'Human Resources',
                'Medicine', 'Nursing', 'Public Health', 'Biotechnology', 'Healthcare Administration',
                'Education Leadership', 'Curriculum Development', 'Educational Technology', 'Higher Education',
                'Corporate Law', 'International Law', 'Legal Studies', 'Compliance',
                'Graphic Design', 'Fashion Design', 'Interior Design', 'Animation',
                'Film Production', 'Creative Writing', 'Journalism',
                'Physics', 'Chemistry', 'Biology', 'Environmental Science', 'Mathematics', 'Statistics',
                'Psychology', 'Sociology', 'Political Science', 'Economics',
                'Leadership Development', 'Career Development', 'Public Speaking', 'Negotiation Skills',
                'Machine Learning', 'Blockchain', 'Robotics', 'Augmented Reality', 'Virtual Reality',
                'Hospitality Management', 'Sports Management', 'Event Management', 'Government Administration'
            ];

            const isCustomSubject = !predefinedSubjects.includes(subjectName);

            // If it's a custom subject, add to database first
            if (isCustomSubject) {
                try {
                    await addCustomSubject(subjectName);
                    console.log('Custom subject added to database:', subjectName);
                } catch (error) {
                    // Still add it locally even if API fails
                    console.log('Failed to add custom subject to DB, adding locally:', error);
                }
            } else {
                console.log('Predefined subject, not adding to DB:', subjectName);
            }

            const newSubjects = [...form.data.subjects, subjectName];

            // Use direct data assignment instead of setData
            form.data.subjects = newSubjects;
            form.data.subject_difficulties = {
                ...form.data.subject_difficulties,
                [subjectName]: 2, // Default difficulty
            };
            setSubjectInputValue('');
            setNewSubject('');

            // Force form to recognize the change
            form.setData('subjects', newSubjects);
            form.setData('subject_difficulties', form.data.subject_difficulties);

            // Force re-render of subjects list
            setSubjectsKey(prev => prev + 1);
        }
    };

    const removeSubject = (subject: string) => {
        const newSubjects = form.data.subjects.filter((s: string) => s !== subject);
        const newDifficulties = { ...form.data.subject_difficulties };
        delete newDifficulties[subject];

        form.setData('subjects', newSubjects);
        form.setData('subject_difficulties', newDifficulties);

        // Force re-render
        setSubjectsKey(prev => prev + 1);
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
                <div className="flex items-center justify-between">
                    <Heading
                        title="Study Preferences"
                        description="Update your learning preferences and study settings"
                    />
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleReset}
                            className="text-destructive hover:text-destructive"
                        >
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Reset Onboarding
                        </Button>
                    </div>
                </div>

                {/* Study Hours Warnings */}
                {(flash as any)?.study_hours_warnings && (
                    <div className="space-y-3">
                        {(flash as any).study_hours_warnings.map((warning: string, index: number) => (
                            <Alert key={index} className="border-amber-200 bg-amber-50">
                                <AlertTriangle className="h-4 w-4 text-amber-600" />
                                <AlertDescription className="text-amber-800">
                                    {warning}
                                </AlertDescription>
                            </Alert>
                        ))}

                        {(flash as any)?.hours_adjusted && (flash as any)?.study_hours_recommendations && (
                            <Alert className="border-blue-200 bg-blue-50">
                                <Info className="h-4 w-4 text-blue-600" />
                                <AlertDescription className="text-blue-800">
                                    <div className="font-medium mb-2">⚠️ Hours Automatically Adjusted</div>
                                    <ul className="list-disc list-inside space-y-1 text-sm">
                                        {(flash as any).study_hours_recommendations.map((rec: string, index: number) => (
                                            <li key={index}>{rec}</li>
                                        ))}
                                    </ul>
                                    <div className="mt-2 text-sm">
                                        Your study time has been adjusted from {(flash as any).original_hours} to {(flash as any).recommended_hours} hours for optimal learning.
                                    </div>
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Subjects Section */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            <Settings className="w-5 h-5" />
                            Subjects & Goals
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="subjects">Your Subjects</Label>
                                <div className="mt-2 space-y-2">
                                    {Array.isArray(form.data.subjects) ? form.data.subjects.map((subject: string) => (
                                        <div key={`${subject}-${subjectsKey}`} className="flex items-center gap-2 p-3 border rounded-lg">
                                            <span className="flex-1 font-medium">{subject}</span>
                                            <Select
                                                value={form.data.subject_difficulties[subject]?.toString() || '2'}
                                                onValueChange={(value) => updateSubjectDifficulty(subject, parseInt(value))}
                                            >
                                                <SelectTrigger className="w-32">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="1">Easy</SelectItem>
                                                    <SelectItem value="2">Medium</SelectItem>
                                                    <SelectItem value="3">Hard</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => removeSubject(subject)}
                                            >
                                                Remove
                                            </Button>
                                        </div>
                                    )) : (
                                        <div className="text-muted-foreground">No subjects added yet</div>
                                    )}
                                </div>

                                <div className="mt-2">
                                    <SimpleAutocomplete
                                        value={subjectInputValue}
                                        onValueChange={setSubjectInputValue}
                                        onSelect={addSubject}
                                        suggestions={suggestions}
                                        selectedSubjects={form.data.subjects}
                                        onRemoveSubject={removeSubject}
                                        placeholder="Type to search subjects (e.g., Mathematics, Physics, Chemistry)..."
                                        className="w-full"
                                    />
                                </div>
                                <InputError message={form.errors.subjects} />
                            </div>

                            <div>
                                <Label htmlFor="study_goal">Study Goal</Label>
                                <Input
                                    id="study_goal"
                                    value={form.data.study_goal}
                                    onChange={(e) => form.setData('study_goal', e.target.value)}
                                    placeholder="e.g., Master TypeScript in 3 months, Pass AWS certification, etc."
                                />
                                <InputError message={form.errors.study_goal} />
                            </div>
                        </div>
                    </div>

                    {/* Study Schedule Section */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Study Schedule</h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="daily_study_hours">Daily Study Hours</Label>
                                <Input
                                    id="daily_study_hours"
                                    type="number"
                                    min={1}
                                    max={16}
                                    value={form.data.daily_study_hours}
                                    onChange={(e) => form.setData('daily_study_hours', parseInt(e.target.value))}
                                />
                                <p className="text-sm text-gray-600 mt-1">
                                    Recommended: 1-6 hours for optimal focus and retention
                                </p>
                                <InputError message={form.errors.daily_study_hours} />
                            </div>

                            <div>
                                <Label htmlFor="productivity_peak">Peak Productivity Time</Label>
                                <Select
                                    value={form.data.productivity_peak}
                                    onValueChange={(value) => form.setData('productivity_peak', value)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select your peak time" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {peakTimes.map((time) => (
                                            <SelectItem key={time.value} value={time.value}>
                                                {time.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <InputError message={form.errors.productivity_peak} />
                            </div>
                        </div>
                    </div>

                    {/* Learning Preferences Section */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Learning Preferences</h3>

                        <div className="space-y-4">
                            <div>
                                <Label>Learning Style</Label>
                                <div className="mt-2 space-y-2">
                                    {learningStyles.map((style) => (
                                        <div key={style.value} className="flex items-center space-x-2">
                                            <Checkbox
                                                id={style.value}
                                                checked={form.data.learning_style.includes(style.value)}
                                                onCheckedChange={(checked) => {
                                                    if (checked) {
                                                        form.setData('learning_style', [...form.data.learning_style, style.value]);
                                                    } else {
                                                        form.setData('learning_style', form.data.learning_style.filter((s: string) => s !== style.value));
                                                    }
                                                }}
                                            />
                                            <Label htmlFor={style.value} className="text-sm">
                                                {style.label}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                                <InputError message={form.errors.learning_style} />
                            </div>

                            <div>
                                <Label htmlFor="timezone">Timezone</Label>
                                <Input
                                    id="timezone"
                                    value={form.data.timezone}
                                    onChange={(e) => form.setData('timezone', e.target.value)}
                                    placeholder="e.g., Asia/Yangon"
                                />
                                <InputError message={form.errors.timezone} />
                            </div>
                        </div>
                    </div>

                    {/* Study Plan Options */}
                    {activePlan && (
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold">Study Plan Options</h3>

                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="regenerate_plan"
                                    checked={form.data.regenerate_plan}
                                    onCheckedChange={(checked) => form.setData('regenerate_plan', checked as boolean)}
                                />
                                <Label htmlFor="regenerate_plan" className="text-sm">
                                    Generate a new study plan with these preferences
                                </Label>
                            </div>
                            <p className="text-sm text-gray-600">
                                This will create a new study schedule based on your updated preferences. Your current plan will be deactivated.
                            </p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex justify-end gap-4 pt-6 border-t">
                        <Button
                            type="submit"
                            disabled={form.processing}
                            className="flex items-center gap-2"
                        >
                            <Save className="h-4 w-4" />
                            {form.processing ? 'Saving...' : 'Save Preferences'}
                        </Button>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
