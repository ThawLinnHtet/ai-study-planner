import { useState, useEffect, useCallback } from 'react';

export function useSimpleSubjects() {
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [customSubjects, setCustomSubjects] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Essential professional subjects for key fields and roles
    const commonSubjects = [
        // Technology & Engineering
        'Artificial Intelligence',
        'Data Science',
        'Cybersecurity',
        'Software Engineering',
        'Web Development',
        'Mobile Development',
        'UI/UX Design',
        'Cloud Computing',
        'DevOps',

        // Business & Finance
        'Business Administration',
        'Financial Analysis',
        'Marketing',
        'Accounting',
        'Project Management',
        'Digital Marketing',
        'Supply Chain Management',
        'Human Resources',

        // Healthcare & Medicine
        'Medicine',
        'Nursing',
        'Public Health',
        'Biotechnology',
        'Healthcare Administration',

        // Education & Academia
        'Education Leadership',
        'Curriculum Development',
        'Educational Technology',
        'Higher Education',

        // Law & Legal Studies
        'Corporate Law',
        'International Law',
        'Legal Studies',
        'Compliance',

        // Creative Arts & Design
        'Graphic Design',
        'Fashion Design',
        'Interior Design',
        'Animation',
        'Film Production',
        'Creative Writing',
        'Journalism',

        // Sciences & Research
        'Physics',
        'Chemistry',
        'Biology',
        'Environmental Science',
        'Mathematics',
        'Statistics',

        // Social Sciences
        'Psychology',
        'Sociology',
        'Political Science',
        'Economics',

        // Professional Development
        'Leadership Development',
        'Career Development',
        'Public Speaking',
        'Negotiation Skills',

        // Advanced Technologies
        'Machine Learning',
        'Blockchain',
        'Robotics',
        'Augmented Reality',
        'Virtual Reality',

        // Industry-Specific
        'Hospitality Management',
        'Sports Management',
        'Event Management',
        'Government Administration'
    ];

    const searchSubjects = useCallback(async (query: string) => {
        if (!query.trim()) {
            setSuggestions([]);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Try API first (if Laravel is running)
            const response = await fetch(`/api/subjects/search?q=${encodeURIComponent(query)}`);
            if (response.ok) {
                const data = await response.json();
                setSuggestions(data.subjects || []);
                return;
            }
        } catch (err) {
            // API failed - use local fallback
        }

        // Always use local fallback as primary (fast and reliable)
        const filtered = commonSubjects.filter(subject =>
            subject.toLowerCase().includes(query.toLowerCase())
        );

        setSuggestions(filtered);
        setLoading(false);
    }, []);

    const addCustomSubject = useCallback(async (name: string) => {
        try {
            // Add to database
            const response = await fetch('/api/subjects', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({ name: name.trim() }),
            });

            if (response.ok) {
                const result = await response.json();

                // Add to local custom subjects for immediate use
                if (!customSubjects.includes(name.trim())) {
                    setCustomSubjects(prev => [...prev, name.trim()]);
                }

                return { name, isCustom: true, addedToDb: true };
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to add custom subject');
            }
        } catch (err) {
            // Still add to local custom subjects even if API fails
            if (!customSubjects.includes(name.trim())) {
                setCustomSubjects(prev => [...prev, name.trim()]);
            }
            return { name, isCustom: true, addedToDb: false };
        }
    }, [customSubjects]);

    return {
        suggestions,
        customSubjects,
        loading,
        error,
        searchSubjects,
        addCustomSubject,
    };
}
