import { Head, Link, useForm, usePage } from '@inertiajs/react';
import DeleteUser from '@/components/delete-user';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Upload, Calendar, Target, Award, Flame, TrendingUp, Clock, BookOpen, X, Edit } from 'lucide-react';
import { useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { edit } from '@/routes/profile';
import { send } from '@/routes/verification';
import { ProfilePictureModal } from '@/components/profile-picture-modal';
import type { BreadcrumbItem, SharedData } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Profile settings',
        href: edit().url,
    },
];

export default function Profile({
    mustVerifyEmail,
    status,
    stats,
}: {
    mustVerifyEmail: boolean;
    status?: string;
    stats: {
        total_study_hours: number;
        current_streak: number;
        longest_streak: number;
        completed_sessions: number;
        weekly_goal: number;
        weekly_progress: number;
        achievements: Array<{
            id: string | number;
            name: string;
            description: string;
            icon: string;
            earned: boolean;
            earned_at: string | null;
        }>;
    };
}) {
    const { auth } = usePage<SharedData>().props;
    const form = useForm({
        name: auth.user.name,
        email: auth.user.email,
    });

    // Use dynamic data from passed stats prop, with fallbacks
    const studyStats = {
        totalStudyHours: stats.total_study_hours || 0,
        currentStreak: stats.current_streak || 0,
        longestStreak: stats.longest_streak || 0,
        completedSessions: stats.completed_sessions || 0,
        weeklyGoal: stats.weekly_goal || 20,
        weeklyProgress: stats.weekly_progress || 0,
    };

    const achievements = stats.achievements || [];

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    const getIconComponent = (iconName: string) => {
        const icons: Record<string, any> = {
            'flame': Flame,
            'book-open': BookOpen,
            'clock': Clock,
            'target': Target,
        };
        return icons[iconName] || Award;
    };

    // Profile picture modal
    const [isPictureModalOpen, setIsPictureModalOpen] = useState(false);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Profile settings" />

            <div className="space-y-6 p-6">
                {/* Profile Picture & Basic Info */}
                <Card>
                    <CardHeader>
                        <CardTitle>Profile Overview</CardTitle>
                        <CardDescription>
                            Manage your profile picture and basic information
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center space-x-6">
                            <div className="relative">
                                <Avatar className="h-20 w-20">
                                    <AvatarImage src={auth.user.avatar ? `/storage/${auth.user.avatar}` : undefined} />
                                    <AvatarFallback className="text-lg">
                                        {getInitials(auth.user.name)}
                                    </AvatarFallback>
                                </Avatar>

                                <Button
                                    size="sm"
                                    className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full p-0"
                                    variant="secondary"
                                    onClick={() => setIsPictureModalOpen(true)}
                                >
                                    <Edit className="h-4 w-4" />
                                </Button>
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-medium">{auth.user.name}</h3>
                                <p className="text-sm text-muted-foreground">{auth.user.email}</p>
                                <div className="flex items-center mt-2 space-x-4">
                                    <div className="flex items-center text-sm">
                                        <Flame className="h-4 w-4 mr-1 text-orange-500" />
                                        <span className="font-medium">{studyStats.currentStreak}</span>
                                        <span className="text-muted-foreground ml-1">
                                            {studyStats.currentStreak === 1 ? 'day streak' : 'days streak'}
                                        </span>
                                    </div>
                                    <div className="flex items-center text-sm">
                                        <Clock className="h-4 w-4 mr-1 text-blue-500" />
                                        <span className="font-medium">{studyStats.totalStudyHours}h</span>
                                        <span className="text-muted-foreground ml-1">
                                            {studyStats.totalStudyHours === 1 ? 'hour studied' : 'hours studied'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Study Statistics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-center space-x-2">
                                <Flame className="h-8 w-8 text-orange-500" />
                                <div>
                                    <p className="text-2xl font-bold">{studyStats.currentStreak}</p>
                                    <p className="text-sm text-muted-foreground">Current Streak</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-center space-x-2">
                                <Clock className="h-8 w-8 text-blue-500" />
                                <div>
                                    <p className="text-2xl font-bold">{studyStats.totalStudyHours}h</p>
                                    <p className="text-sm text-muted-foreground">Total Hours</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-center space-x-2">
                                <Target className="h-8 w-8 text-green-500" />
                                <div>
                                    <p className="text-2xl font-bold">{studyStats.completedSessions}</p>
                                    <p className="text-sm text-muted-foreground">Sessions</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-center space-x-2">
                                <Award className="h-8 w-8 text-purple-500" />
                                <div>
                                    <p className="text-2xl font-bold">{achievements.filter(a => a.earned).length}</p>
                                    <p className="text-sm text-muted-foreground">Achievements</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Weekly Progress */}
                <Card>
                    <CardHeader>
                        <CardTitle>Weekly Progress</CardTitle>
                        <CardDescription>
                            Your progress towards this week's study goal
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex justify-between text-sm">
                                <span>Weekly Goal</span>
                                <span>{studyStats.weeklyProgress} / {studyStats.weeklyGoal} hours</span>
                            </div>
                            <Progress value={studyStats.weeklyGoal > 0 ? (studyStats.weeklyProgress / studyStats.weeklyGoal) * 100 : 0} className="h-2" />
                            <p className="text-sm text-muted-foreground">
                                {studyStats.weeklyGoal - studyStats.weeklyProgress > 0
                                    ? `${studyStats.weeklyGoal - studyStats.weeklyProgress} more ${studyStats.weeklyGoal - studyStats.weeklyProgress === 1 ? 'hour' : 'hours'} to reach your weekly goal!`
                                    : 'Weekly goal achieved! Great job!'
                                }
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Achievements */}
                <Card>
                    <CardHeader>
                        <CardTitle>Achievements</CardTitle>
                        <CardDescription>
                            Your study milestones and accomplishments
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {achievements.map((achievement) => {
                                const IconComponent = getIconComponent(achievement.icon);
                                return (
                                    <div
                                        key={achievement.id}
                                        className={`flex items-center space-x-3 p-3 rounded-lg border ${achievement.earned
                                            ? 'bg-primary/10 border-primary/20'
                                            : 'bg-muted border-muted opacity-50'
                                            }`}
                                    >
                                        <div className={`p-2 rounded-full ${achievement.earned ? 'bg-primary/20' : 'bg-muted'
                                            }`}>
                                            <IconComponent className={`h-5 w-5 ${achievement.earned ? 'text-primary' : 'text-muted-foreground'
                                                }`} />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-medium text-sm">{achievement.name}</h4>
                                            <p className="text-xs text-muted-foreground">{achievement.description}</p>
                                            {achievement.earned && achievement.earned_at && (
                                                <p className="text-[10px] text-muted-foreground/60 mt-1">Unlocked on {achievement.earned_at}</p>
                                            )}
                                        </div>
                                        {achievement.earned && (
                                            <Badge variant="secondary" className="text-xs">
                                                Earned
                                            </Badge>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>

                {/* Edit Profile Information */}
                <Card>
                    <CardHeader>
                        <CardTitle>Edit Profile Information</CardTitle>
                        <CardDescription>
                            Update your name and email address
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form
                            className="space-y-4"
                            onSubmit={(e) => {
                                e.preventDefault();
                                form.patch('/settings/profile', {
                                    preserveScroll: true,
                                });
                            }}
                        >
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Name</Label>
                                    <Input
                                        id="name"
                                        value={form.data.name}
                                        onChange={(e) => form.setData('name', e.target.value)}
                                        name="name"
                                        required
                                        autoComplete="name"
                                        placeholder="Full name"
                                    />
                                    <InputError message={form.errors.name} />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="email">Email address</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={form.data.email}
                                        onChange={(e) => form.setData('email', e.target.value)}
                                        name="email"
                                        required
                                        autoComplete="username"
                                        placeholder="Email address"
                                        disabled={!!auth.user.auth_provider}
                                    />
                                    {!!auth.user.auth_provider && (
                                        <p className="text-[13px] text-muted-foreground mt-1">
                                            Your email is managed by your connected Google account.
                                        </p>
                                    )}
                                    <InputError message={form.errors.email} />
                                </div>

                                {mustVerifyEmail &&
                                    auth.user.email_verified_at === null && (
                                        <div className="rounded-lg bg-yellow-50 p-3 dark:bg-yellow-900/20">
                                            <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                                Your email address is unverified.{' '}
                                                <Link
                                                    href={send()}
                                                    as="button"
                                                    className="font-medium underline hover:text-yellow-900 dark:hover:text-yellow-100"
                                                >
                                                    Click here to resend the verification email.
                                                </Link>
                                            </p>

                                            {status === 'verification-link-sent' && (
                                                <div className="mt-2 text-sm font-medium text-green-600">
                                                    A new verification link has been sent to your email address.
                                                </div>
                                            )}
                                        </div>
                                    )}

                                <div className="flex items-center gap-4 pt-4">
                                    <Button
                                        disabled={form.processing}
                                        data-test="update-profile-button"
                                    >
                                        Save
                                    </Button>

                                    {form.recentlySuccessful && (
                                        <p className="text-sm text-green-600">Saved</p>
                                    )}
                                </div>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                <DeleteUser />

                {/* Profile Picture Modal */}
                <ProfilePictureModal
                    isOpen={isPictureModalOpen}
                    onClose={() => setIsPictureModalOpen(false)}
                    currentAvatar={auth.user.avatar}
                    userName={auth.user.name}
                />
            </div>
        </AppLayout>
    );
}
