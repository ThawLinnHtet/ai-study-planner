/**
 * Utility to provide consistent, professional colors for subjects
 * uses HSL to ensure accessibility and aesthetic harmony
 */

export interface SubjectColor {
    id: string;
    bg: string;
    text: string;
    border: string;
    glow: string;
    primary: string;
}

const COLORS: Record<string, SubjectColor> = {
    indigo: {
        id: 'indigo',
        bg: 'bg-indigo-500/10',
        text: 'text-indigo-500',
        border: 'border-indigo-500/20',
        glow: 'shadow-indigo-500/20',
        primary: 'bg-indigo-500',
    },
};

/**
 * Maps a subject name to a consistent, neutral color
 */
export function getSubjectColor(subjectName: string): SubjectColor {
    return COLORS.indigo;
}

/**
 * Returns a CSS gradient string based on subject name
 */
export function getSubjectGradient(subjectName: string): string {
    return `from-indigo-500/10 to-transparent`;
}
