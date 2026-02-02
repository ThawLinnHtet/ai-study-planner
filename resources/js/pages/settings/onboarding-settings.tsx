import { Head, Link, useForm, usePage } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SimpleAutocomplete } from '@/components/ui/simple-autocomplete';
import { useSimpleSubjects } from '@/hooks/useSimpleSubjects';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import {
    Settings,
    RotateCcw,
    Save,
    AlertTriangle,
    BookOpen,
    Clock,
    User as UserIcon,
    Brain,
    X
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
    const [showResetDialog, setShowResetDialog] = useState(false);
    const [subjectsKey, setSubjectsKey] = useState(0); // Force re-render

    // TanStack Query for subjects
    const { allSubjects, loading, addCustomSubject, useSearchSuggestions } = useSimpleSubjects();
    const [subjectInputValue, setSubjectInputValue] = useState('');

    // Search suggestions hook
    const { data: searchData, isLoading: searchLoading } = useSearchSuggestions(subjectInputValue);
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
        form.put('/settings/onboarding', {
            onError: (errors) => {
                toast.error('Validation failed: ' + Object.values(errors).join(', '));
            },
            onSuccess: () => {
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

    const handleRecommendedReset = () => {
        // Clear all subjects but keep other settings
        form.setData('subjects', []);
        form.setData('subject_difficulties', {});
        setSubjectInputValue('');
        setSubjectsKey(prev => prev + 1);
        setShowResetDialog(false);
        toast.success('Subjects cleared. You can now add new subjects and generate a fresh schedule.');
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
                } catch (error) {
                    // Still add it locally even if API fails
                }
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

            // Trigger immediate search to refresh suggestions
            if (subjectInputValue.trim()) {
                // This will trigger the useSearchSuggestions hook to refresh
                setSubjectInputValue('');
                setTimeout(() => setSubjectInputValue(subjectName[0]), 100);
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
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Study Preferences</h1>
                        <p className="text-muted-foreground">Manage your subjects and study settings</p>
                        <p className="text-sm text-muted-foreground mt-2">
                            Update your learning preferences and generate new study plans
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={() => {
                                form.setData('regenerate_plan', true);
                                form.submit();
                            }}
                            className="bg-primary hover:bg-primary/90"
                        >
                            <Brain className="w-4 h-4 mr-2" />
                            Generate Schedule
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => setShowResetDialog(true)}
                        >
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Start Over
                        </Button>
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
                                                        <SelectTrigger className="w-24 h-8">
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
                                    <Input
                                        id="daily_study_hours"
                                        type="number"
                                        min="1"
                                        max="16"
                                        value={form.data.daily_study_hours}
                                        onChange={(e) => form.setData('daily_study_hours', parseInt(e.target.value))}
                                        placeholder="e.g., 4"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Recommended: 2-6 hours for optimal learning
                                    </p>
                                    {form.errors.daily_study_hours && (
                                        <p className="text-sm text-destructive">{form.errors.daily_study_hours}</p>
                                    )}
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
                                            <SelectItem value="morning">Morning (6AM - 12PM)</SelectItem>
                                            <SelectItem value="afternoon">Afternoon (12PM - 6PM)</SelectItem>
                                            <SelectItem value="evening">Evening (6PM - 10PM)</SelectItem>
                                            <SelectItem value="night">Night (10PM - 6AM)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {form.errors.productivity_peak && (
                                        <p className="text-sm text-destructive">{form.errors.productivity_peak}</p>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Learning Preferences Section */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <UserIcon className="w-5 h-5" />
                                Learning Preferences
                            </CardTitle>
                            <CardDescription>
                                Customize your learning style and goals
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <Label className="text-sm font-medium mb-3 block">Learning Style</Label>
                                    <div className="space-y-2">
                                        {[
                                            { value: 'visual', label: 'Visual' },
                                            { value: 'auditory', label: 'Auditory' },
                                            { value: 'reading', label: 'Reading/Writing' },
                                            { value: 'kinesthetic', label: 'Kinesthetic' }
                                        ].map((style) => (
                                            <div key={style.value} className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={style.value}
                                                    checked={form.data.learning_style?.includes(style.value)}
                                                    onCheckedChange={(checked) => {
                                                        const currentStyles = form.data.learning_style || [];
                                                        if (checked) {
                                                            form.setData('learning_style', [...currentStyles, style.value]);
                                                        } else {
                                                            form.setData('learning_style', currentStyles.filter((s: string) => s !== style.value));
                                                        }
                                                    }}
                                                />
                                                <Label htmlFor={style.value} className="text-sm">{style.label}</Label>
                                            </div>
                                        ))}
                                    </div>
                                    {form.errors.learning_style && (
                                        <p className="text-sm text-destructive">{form.errors.learning_style}</p>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <Label htmlFor="study_goal">Study Goal</Label>
                                        <Input
                                            id="study_goal"
                                            value={form.data.study_goal}
                                            onChange={(e) => form.setData('study_goal', e.target.value)}
                                            placeholder="e.g., Prepare for final exams, Learn new skills"
                                        />
                                        {form.errors.study_goal && (
                                            <p className="text-sm text-destructive">{form.errors.study_goal}</p>
                                        )}
                                    </div>

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
                    <div className="flex items-center justify-between pt-4 border-t">
                        <p className="text-sm text-muted-foreground">
                            Changes are saved automatically. Click "Generate Schedule" to create a new study plan.
                        </p>
                        <Button
                            type="submit"
                            disabled={form.processing}
                            className="flex items-center gap-2"
                        >
                            <Save className="h-4 w-4" />
                            {form.processing ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </div>
                </form>

                {/* Reset Options Dialog */}
                {showResetDialog && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                            <h3 className="text-lg font-semibold mb-4">Choose Your Reset Option</h3>

                            <div className="space-y-4 mb-6">
                                <div className="p-4 border rounded-lg">
                                    <h4 className="font-medium text-green-700 mb-2">🔄 Recommended: Clear Subjects Only</h4>
                                    <p className="text-sm text-gray-600 mb-2">
                                        Remove all subjects and start fresh, but keep your study schedule preferences.
                                    </p>
                                    <ul className="text-xs text-gray-500 space-y-1">
                                        <li>✅ Keeps: Study hours, productivity time, learning style</li>
                                        <li>✅ Keeps: Study goal, timezone, other settings</li>
                                        <li>❌ Removes: All subjects and difficulty settings</li>
                                        <li>🔄 Action: Add new subjects → Generate new schedule</li>
                                    </ul>
                                </div>

                                <div className="p-4 border rounded-lg">
                                    <h4 className="font-medium text-red-700 mb-2">⚠️ Complete Reset</h4>
                                    <p className="text-sm text-gray-600 mb-2">
                                        Start completely over with onboarding. This removes everything.
                                    </p>
                                    <ul className="text-xs text-gray-500 space-y-1">
                                        <li>❌ Removes: All subjects and preferences</li>
                                        <li>❌ Removes: Study hours, learning style, goals</li>
                                        <li>❌ Deactivates: Current study plan</li>
                                        <li>🔄 Action: Go through full onboarding again</li>
                                    </ul>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <Button
                                    onClick={handleRecommendedReset}
                                    className="flex-1 bg-green-600 hover:bg-green-700"
                                >
                                    Clear Subjects Only
                                </Button>
                                <Button
                                    onClick={handleReset}
                                    variant="destructive"
                                    className="flex-1"
                                >
                                    Complete Reset
                                </Button>
                                <Button
                                    onClick={() => setShowResetDialog(false)}
                                    variant="outline"
                                    className="flex-1"
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
