import { useState, useCallback } from 'react';

interface Subject {
    id: number;
    name: string;
    slug: string;
    description: string;
    category: string;
    icon: string;
    color: string;
    usage_count: number;
    is_custom: boolean;
}

interface SubjectsResponse {
    global: Subject[];
    custom: Subject[];
}

export function useSubjects() {
    const [subjects, setSubjects] = useState<SubjectsResponse>({
        global: [],
        custom: [],
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const searchSubjects = useCallback(async (query: string) => {
        if (!query.trim()) {
            setSubjects({ global: [], custom: [] });
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/subjects/search?q=${encodeURIComponent(query)}&limit=20`);
            if (!response.ok) {
                throw new Error('Failed to fetch subjects');
            }
            const apiResponse = await response.json();

            // Convert API response { subjects: [...] } to expected format { global: [...], custom: [] }
            const subjects = apiResponse.subjects || [];
            const formattedData: SubjectsResponse = {
                global: subjects.map((name: string) => ({
                    id: Math.random(), // Temporary ID
                    name,
                    slug: name.toLowerCase().replace(/\s+/g, '-'),
                    description: '',
                    category: 'General',
                    icon: 'book-open',
                    color: '#6366f1',
                    usage_count: 0,
                    is_custom: false
                })),
                custom: []
            };

            setSubjects(formattedData);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
            setSubjects({ global: [], custom: [] });
        } finally {
            setIsLoading(false);
        }
    }, []);

    const addCustomSubject = useCallback(async (name: string, description?: string, category?: string) => {
        try {
            const response = await fetch('/api/subjects', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({
                    name: name.trim(),
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to add subject');
            }

            const result = await response.json();
            return {
                id: Math.random(), // Temporary ID
                name: result.subject.name,
                slug: result.subject.name.toLowerCase().replace(/\s+/g, '-'),
                description: description?.trim() || '',
                category: category?.trim() || 'Custom',
                icon: 'book-open',
                color: '#6366f1',
                usage_count: 0,
                is_custom: true
            };
        } catch (err) {
            throw new Error(err instanceof Error ? err.message : 'Failed to add subject');
        }
    }, []);

    const trackUsage = useCallback(async (subjectName: string) => {
        try {
            await fetch('/api/subjects/track', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({
                    subject_name: subjectName,
                }),
            });
        } catch (err) {
            // Silent fail - don't block user experience
            console.warn('Failed to track subject usage:', err);
        }
    }, []);

    const getPopularSubjects = useCallback(async () => {
        try {
            const response = await fetch('/api/subjects/popular');
            if (!response.ok) {
                throw new Error('Failed to fetch popular subjects');
            }
            return await response.json();
        } catch (err) {
            console.error('Failed to fetch popular subjects:', err);
            return [];
        }
    }, []);

    const getCategories = useCallback(async () => {
        try {
            const response = await fetch('/api/subjects/categories');
            if (!response.ok) {
                throw new Error('Failed to fetch categories');
            }
            return await response.json();
        } catch (err) {
            console.error('Failed to fetch categories:', err);
            return [];
        }
    }, []);

    return {
        subjects,
        isLoading,
        error,
        searchSubjects,
        addCustomSubject,
        trackUsage,
        getPopularSubjects,
        getCategories,
    };
}
