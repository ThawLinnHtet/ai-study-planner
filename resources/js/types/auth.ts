export type User = {
    id: number;
    name: string;
    email: string;
    avatar?: string | null;
    email_verified_at: string | null;
    two_factor_enabled?: boolean;
    created_at: string;
    updated_at: string;
    // Study statistics
    total_study_hours?: number;
    current_streak?: number;
    longest_streak?: number;
    completed_sessions?: number;
    weekly_goal?: number;
    weekly_progress?: number;
    achievements?: Achievement[];
    [key: string]: unknown;
};

export type Achievement = {
    id: number;
    name: string;
    description: string;
    icon: string;
    earned: boolean;
    earned_at?: string;
};

export type Auth = {
    user: User;
};

export type TwoFactorSetupData = {
    svg: string;
    url: string;
};

export type TwoFactorSecretKey = {
    secretKey: string;
};
