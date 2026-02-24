import { Head, useForm, usePage } from '@inertiajs/react';
import { useRef, useState } from 'react';
import { Lock, Info, CheckCircle2 } from 'lucide-react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { InputWithValidation } from '@/components/ui/input-with-validation';
import { Label } from '@/components/ui/label';
import { PasswordStrength } from '@/components/ui/password-strength';
import AppLayout from '@/layouts/app-layout';
import { edit } from '@/routes/user-password';
import type { BreadcrumbItem, User } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Password settings',
        href: edit().url,
    },
];

export default function Password() {
    const { auth } = usePage<{ auth: { user: User & { auth_provider?: string } } }>().props;
    const isGoogleUser = auth.user.auth_provider === 'google';

    const passwordInput = useRef<HTMLInputElement>(null);
    const currentPasswordInput = useRef<HTMLInputElement>(null);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isPasswordFocused, setIsPasswordFocused] = useState(false);

    // Real-time validators
    const validatePassword = (value: string) => {
        if (!value) return 'Password is required';
        if (value.length < 8) return 'Password must be at least 8 characters';
        if (!/[A-Z]/.test(value) || !/[a-z]/.test(value)) return 'Password must contain both uppercase and lowercase letters';
        if (!/\d/.test(value)) return 'Password must contain at least one number';
        return null;
    };

    const validateConfirmPassword = (value: string) => {
        if (!value) return 'Please confirm your password';
        if (value !== password) return 'Passwords do not match';
        return null;
    };

    const form = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    const handleUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        form.put('/settings/password', {
            preserveScroll: true,
            onError: (errors) => {
                if (errors.password) passwordInput.current?.focus();
                if (errors.current_password) currentPasswordInput.current?.focus();
                form.reset('password', 'password_confirmation', 'current_password');
                setPassword('');
                setConfirmPassword('');
            },
            onSuccess: () => {
                form.reset('password', 'password_confirmation', 'current_password');
                setPassword('');
                setConfirmPassword('');
            },
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Password settings" />

            <div className="space-y-6 p-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Update Password</CardTitle>
                        <CardDescription>
                            {isGoogleUser
                                ? "Manage your security settings."
                                : "Ensure your account is using a long, random password to stay secure."}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isGoogleUser ? (
                            <div className="flex flex-col items-center text-center space-y-4 py-8">
                                <div className="p-4 bg-blue-500/10 rounded-full">
                                    <Info className="h-10 w-10 text-blue-500" />
                                </div>
                                <div className="space-y-2 max-w-md">
                                    <h3 className="text-xl font-semibold">Managed by Google</h3>
                                    <p className="text-muted-foreground">
                                        Your account is connected via Google Authentication.
                                        Local password changes are disabled for security.
                                    </p>
                                    <p className="text-sm">
                                        You can update your security preferences directly in your <a href="https://myaccount.google.com/security" target="_blank" className="text-primary font-medium hover:underline">Google Account Settings</a>.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <form className="space-y-4" onSubmit={handleUpdate}>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="current_password">Current password</Label>
                                        <Input
                                            id="current_password"
                                            ref={currentPasswordInput}
                                            name="current_password"
                                            type="password"
                                            autoComplete="current-password"
                                            placeholder="Current password"
                                            value={form.data.current_password}
                                            onChange={(e) => form.setData('current_password', e.target.value)}
                                        />
                                        <InputError message={form.errors.current_password} />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="password">New password</Label>
                                        <InputWithValidation
                                            id="password"
                                            ref={passwordInput}
                                            name="password"
                                            type="password"
                                            autoComplete="new-password"
                                            placeholder="Enter your new password"
                                            value={form.data.password}
                                            error={form.errors.password}
                                            onFocus={() => setIsPasswordFocused(true)}
                                            onBlur={() => setIsPasswordFocused(false)}
                                            onChange={(e) => {
                                                form.setData('password', e.target.value);
                                                setPassword(e.target.value);
                                            }}
                                        />
                                        {isPasswordFocused && <PasswordStrength password={password} />}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="password_confirmation">Confirm password</Label>
                                        <InputWithValidation
                                            id="password_confirmation"
                                            name="password_confirmation"
                                            type="password"
                                            autoComplete="new-password"
                                            placeholder="Repeat your password"
                                            value={form.data.password_confirmation}
                                            error={form.errors.password_confirmation}
                                            validateOnChange={true}
                                            validator={validateConfirmPassword}
                                            onChange={(e) => {
                                                form.setData('password_confirmation', e.target.value);
                                                setConfirmPassword(e.target.value);
                                            }}
                                        />
                                    </div>

                                    <div className="flex items-center gap-4 pt-4">
                                        <Button
                                            disabled={form.processing}
                                            data-test="update-password-button"
                                        >
                                            Save password
                                        </Button>

                                        {form.recentlySuccessful && (
                                            <p className="text-sm text-green-600">Saved</p>
                                        )}
                                    </div>
                                </div>
                            </form>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
