import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';

// API functions
const fetchSubjects = async () => {
    const response = await fetch('/api/subjects');
    if (!response.ok) {
        throw new Error('Failed to fetch subjects');
    }
    return response.json();
};

const searchSubjectsAPI = async (query: string) => {
    const response = await fetch(`/api/subjects/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) {
        throw new Error('Failed to search subjects');
    }
    return response.json();
};

const addSubjectAPI = async (name: string) => {
    const response = await fetch('/api/subjects', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
        },
        body: JSON.stringify({ name: name.trim() }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add custom subject');
    }

    return response.json();
};

export function useSimpleSubjects() {
    const queryClient = useQueryClient();

    // Query for all subjects
    const {
        data: subjectsData,
        isLoading: subjectsLoading,
        error: subjectsError,
    } = useQuery({
        queryKey: ['subjects'],
        queryFn: fetchSubjects,
        staleTime: 10 * 60 * 1000, // 10 minutes
        gcTime: 15 * 60 * 1000, // 15 minutes (formerly cacheTime)
    });

    // Query for search suggestions
    const useSearchSuggestions = (query: string) => {
        return useQuery({
            queryKey: ['subjects', 'search', query],
            queryFn: () => searchSubjectsAPI(query),
            enabled: query.trim().length > 0,
            staleTime: 5 * 60 * 1000, // 5 minutes
        });
    };

    // Mutation for adding custom subjects
    const addSubjectMutation = useMutation({
        mutationFn: addSubjectAPI,
        onMutate: async (newSubject) => {
            // Cancel any outgoing refetches
            await queryClient.cancelQueries({ queryKey: ['subjects'] });

            // Snapshot the previous value
            const previousSubjects = queryClient.getQueryData(['subjects']);

            // Optimistically update to the new value
            queryClient.setQueryData(['subjects'], (old: any) => {
                if (old?.subjects) {
                    return {
                        ...old,
                        subjects: [...old.subjects, newSubject.trim()]
                    };
                }
                return old;
            });

            return { previousSubjects };
        },
        onError: (err, newSubject, context) => {
            // Rollback on error
            queryClient.setQueryData(['subjects'], context?.previousSubjects);
        },
        onSuccess: () => {
            // Invalidate all subjects queries to refresh data
            queryClient.invalidateQueries({ queryKey: ['subjects'] });
        },
        onSettled: () => {
            // Always refetch after error or success
            queryClient.invalidateQueries({ queryKey: ['subjects'] });
        },
    });

    // Legacy compatibility functions
    const searchSubjects = async (query: string) => {
        // This is handled by the useSearchSuggestions hook now
        console.log('searchSubjects is deprecated, use useSearchSuggestions hook instead');
    };

    const addCustomSubject = async (name: string) => {
        try {
            const result = await addSubjectMutation.mutateAsync(name);
            return { name, isCustom: true, addedToDb: true };
        } catch (err) {
            console.log('Failed to add custom subject:', err);
            return { name, isCustom: true, addedToDb: false };
        }
    };

    const allSubjects = subjectsData?.subjects || [];
    const suggestions: string[] = []; // This is now handled by useSearchSuggestions hook
    const loading = subjectsLoading;
    const error = subjectsError?.message || null;

    return {
        suggestions,
        allSubjects,
        loading,
        error,
        searchSubjects,
        addCustomSubject,
        useSearchSuggestions, // New hook for search functionality
        addSubjectMutation, // Expose mutation for more control
    };
}
