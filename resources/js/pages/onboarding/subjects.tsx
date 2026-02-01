import { Head, useForm } from '@inertiajs/react';
import { useState, useEffect, useMemo } from 'react';
import { X, BookOpen, Atom, Calculator, Globe, Briefcase, Palette, Stethoscope, Building, Gavel, Brain } from 'lucide-react';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import OnboardingLayout from '@/layouts/onboarding-layout';
import { cn } from '@/lib/utils';
import { useSubjects } from '@/hooks/useSubjects';

type Subject = {
    id: number;
    name: string;
    exam_date: string | null;
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

export default function OnboardingSubjects({
    subjects: existingSubjects,
}: {
    subjects: Subject[];
}) {
    const [selectedSubjects, setSelectedSubjects] = useState<string[]>(
        existingSubjects.map((s) => s.name)
    );
    const [inputValue, setInputValue] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    // Use the subjects API hook
    const { subjects, isLoading, searchSubjects, addCustomSubject, trackUsage } = useSubjects();

    // Group subjects by category
    const groupedSubjects = useMemo(() => {
        const allSubjects = [...subjects.global, ...subjects.custom];
        return allSubjects.reduce((acc, subject) => {
            if (!acc[subject.category]) {
                acc[subject.category] = [];
            }
            acc[subject.category].push(subject);
            return acc;
        }, {} as Record<string, any[]>);
    }, [subjects]);

    // Search subjects when input changes
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            searchSubjects(inputValue);
        }, 300); // Debounce search

        return () => clearTimeout(timeoutId);
    }, [inputValue, searchSubjects]);

    const form = useForm({
        subjects: selectedSubjects,
    });

    // Add subject to selection
    const addSubject = async (subjectName: string) => {
        if (!selectedSubjects.includes(subjectName)) {
            const newSubjects = [...selectedSubjects, subjectName];
            setSelectedSubjects(newSubjects);
            form.setData('subjects', newSubjects);

            // Track usage for analytics
            trackUsage(subjectName);
        }
        setInputValue('');
        setIsOpen(false);
    };

    // Remove subject from selection
    const removeSubject = (subjectName: string) => {
        const newSubjects = selectedSubjects.filter((s) => s !== subjectName);
        setSelectedSubjects(newSubjects);
        form.setData('subjects', newSubjects);
    };

    // Handle custom subject addition
    const handleCustomSubject = async () => {
        const trimmed = inputValue.trim();
        if (trimmed && !selectedSubjects.includes(trimmed)) {
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

    return (
        <>
            <Head title="Subjects - Study Planner" />
            <OnboardingLayout>
                <div className="mx-auto w-full max-w-2xl p-6">
                    <Heading
                        title="Subjects"
                        description="Search and select the subjects you want to study"
                    />

                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            form.post('/onboarding/subjects', {
                                onSuccess: () => {
                                    // Redirect to main onboarding after saving subjects
                                    window.location.href = '/onboarding?step=2';
                                }
                            });
                        }}
                    >
                        <div className="space-y-6">
                            {/* Autocomplete Input */}
                            <div className="relative">
                                <Command className="rounded-lg border shadow-md">
                                    <CommandInput
                                        placeholder="Search subjects or type custom subject..."
                                        value={inputValue}
                                        onValueChange={setInputValue}
                                        onFocus={() => setIsOpen(true)}
                                    />

                                    {isOpen && (
                                        <CommandList className="max-h-64 overflow-y-auto">
                                            <CommandEmpty>
                                                <div className="py-3 text-center text-sm">
                                                    No subject found.
                                                    <Button
                                                        type="button"
                                                        variant="link"
                                                        className="p-0 h-auto text-primary"
                                                        onClick={handleCustomSubject}
                                                    >
                                                        Add "{inputValue}" as custom subject
                                                    </Button>
                                                </div>
                                            </CommandEmpty>

                                            {Object.entries(groupedSubjects).map(([category, subjects]) => (
                                                <CommandGroup key={category} heading={category}>
                                                    {subjects.map((subject) => {
                                                        const Icon = iconMap[subject.icon] || BookOpen;
                                                        const isSelected = selectedSubjects.includes(subject.name);

                                                        return (
                                                            <CommandItem
                                                                key={`${subject.is_custom ? 'custom' : 'global'}-${subject.id || subject.name}`}
                                                                value={subject.name}
                                                                onSelect={() => addSubject(subject.name)}
                                                                className={cn(
                                                                    "flex cursor-pointer items-center gap-3 p-3",
                                                                    isSelected && "bg-primary/10 text-primary"
                                                                )}
                                                            >
                                                                <Icon className="h-4 w-4" />
                                                                <div className="flex-1">
                                                                    <div className="font-medium">{subject.name}</div>
                                                                    <div className="text-xs text-muted-foreground">
                                                                        {subject.description}
                                                                    </div>
                                                                </div>
                                                                {isSelected && (
                                                                    <div className="h-2 w-2 rounded-full bg-primary" />
                                                                )}
                                                                {subject.is_custom && (
                                                                    <Badge variant="outline" className="text-xs">
                                                                        Custom
                                                                    </Badge>
                                                                )}
                                                            </CommandItem>
                                                        );
                                                    })}
                                                </CommandGroup>
                                            ))}
                                        </CommandList>
                                    )}
                                </Command>
                            </div>

                            {/* Selected Subjects */}
                            {selectedSubjects.length > 0 && (
                                <Card>
                                    <CardContent className="pt-6">
                                        <div className="space-y-3">
                                            <h3 className="text-sm font-medium text-muted-foreground">
                                                Selected Subjects ({selectedSubjects.length})
                                            </h3>
                                            <div className="flex flex-wrap gap-2">
                                                {selectedSubjects.map((subject) => (
                                                    <Badge
                                                        key={subject}
                                                        variant="secondary"
                                                        className="flex items-center gap-1 px-3 py-1"
                                                    >
                                                        {subject}
                                                        <X
                                                            className="h-3 w-3 cursor-pointer hover:text-destructive"
                                                            onClick={() => removeSubject(subject)}
                                                        />
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Form Error */}
                            <InputError message={form.errors.subjects} />

                            {/* Navigation */}
                            <div className="flex justify-end">
                                <Button
                                    type="submit"
                                    disabled={form.processing || selectedSubjects.length === 0}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    </form>
                </div>
            </OnboardingLayout>
        </>
    );
}
