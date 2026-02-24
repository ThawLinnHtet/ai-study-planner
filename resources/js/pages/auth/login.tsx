import { Form, Head } from '@inertiajs/react';
import InputError from '@/components/input-error';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { InputWithValidation } from '@/components/ui/input-with-validation';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AuthLayout from '@/layouts/auth-layout';
import { register } from '@/routes';
import { store } from '@/routes/login';
import { request } from '@/routes/password';
import { ArrowRight, BookOpen, Sparkles, Target, Trophy, Users } from 'lucide-react';
import { useState } from 'react';

type Props = {
    status?: string;
    canResetPassword: boolean;
    canRegister: boolean;
};

export default function Login({
    status,
    canResetPassword,
    canRegister,
}: Props) {
    const handleGoogleLogin = () => {
        window.location.href = '/auth/google';
    };

    // Real-time validators
    const validateEmail = (value: string) => {
        if (!value.trim()) return 'Email is required';
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) return 'Please enter a valid email address';
        if (value.length > 255) return 'Email must be less than 255 characters';
        return null;
    };

    const validatePassword = (value: string) => {
        if (!value.trim()) return 'Password is required';
        return null;
    };

    return (
        <AuthLayout
            title="Welcome back"
            description="Pick up your personalized study journey where you left off"
        >
            <Head title="Log in" />

            <div className="grid gap-6 animate-fade-in-up">
                <Card className="border border-border/50 w-full shadow-lg backdrop-blur-sm bg-card/95">
                    <CardHeader className="text-center pt-8">
                        <CardTitle className="text-2xl font-bold tracking-tight">Sign in to continue</CardTitle>
                        <CardDescription className="text-base mt-2">Choose Google or email to get back to your dashboard.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form
                            action={store().url}
                            method={store().method}
                            resetOnSuccess={['password']}
                            className="grid gap-5"
                        >
                            {({ processing, errors }) => (
                                <>
                                    <div className="grid gap-2">
                                        <Label htmlFor="email">Email address</Label>
                                        <InputWithValidation
                                            id="email"
                                            type="email"
                                            name="email"
                                            required
                                            autoFocus
                                            tabIndex={1}
                                            autoComplete="email"
                                            placeholder="you@example.com"
                                            className="h-11"
                                            error={errors.email}
                                            validateOnChange={true}
                                            validator={validateEmail}
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <div className="flex items-center">
                                            <Label htmlFor="password">Password</Label>
                                            {canResetPassword && (
                                                <TextLink
                                                    href={request()}
                                                    className="ml-auto text-xs font-semibold text-primary"
                                                    tabIndex={5}
                                                >
                                                    Forgot password?
                                                </TextLink>
                                            )}
                                        </div>
                                        <InputWithValidation
                                            id="password"
                                            type="password"
                                            name="password"
                                            required
                                            tabIndex={2}
                                            autoComplete="current-password"
                                            placeholder="Enter your password"
                                            className="h-11"
                                            error={errors.password}
                                            validateOnChange={true}
                                            validator={validatePassword}
                                        />
                                    </div>



                                    <Button
                                        type="submit"
                                        className="h-12 w-full bg-primary text-primary-foreground text-base font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
                                        tabIndex={4}
                                        disabled={processing}
                                        data-test="login-button"
                                    >
                                        {processing && <Spinner className="mr-2 h-4 w-4" />}
                                        Sign in to dashboard
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </>
                            )}
                        </Form>

                        <div className="mt-6 space-y-3">
                            <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
                                <span className="h-px w-full bg-border" />
                                <span>or</span>
                                <span className="h-px w-full bg-border" />
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                className="h-12 w-full text-sm font-semibold transition-all hover:bg-secondary/50 hover:scale-[1.02] active:scale-[0.98]"
                                onClick={handleGoogleLogin}
                            >
                                <GoogleIcon className="mr-2 h-4 w-4" />
                                Continue with Google
                            </Button>
                        </div>

                        {canRegister && (
                            <p className="mt-6 text-center text-sm text-muted-foreground">
                                Need an account?{' '}
                                <TextLink href={register()} className="font-semibold text-primary" tabIndex={6}>
                                    Create one free
                                </TextLink>
                            </p>
                        )}
                    </CardContent>
                </Card>

                {status && (
                    <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center text-sm font-medium text-green-700">
                        {status}
                    </div>
                )}
            </div>
        </AuthLayout>
    );
}

const GoogleIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path
            d="M23.49 12.27a11.4 11.4 0 0 0-.21-2.45H12v4.63h6.46a5.54 5.54 0 0 1-2.45 3.68v3h3.96c2.32-2.14 3.65-5.3 3.65-8.86Z"
            fill="#4285F4"
        />
        <path
            d="M12 24c3.24 0 5.96-1.07 7.95-2.87l-3.96-3c-1.1.74-2.5 1.17-3.99 1.17-3.07 0-5.66-2.07-6.59-4.86H1.33v3.06C3.35 21.54 7.35 24 12 24Z"
            fill="#34A853"
        />
        <path
            d="M5.41 14.44a7.31 7.31 0 0 1 0-4.64V6.74H1.33a12 12 0 0 0 0 10.76l4.08-3.06Z"
            fill="#FBBC05"
        />
        <path
            d="M12 4.77c1.76 0 3.33.61 4.56 1.82l3.41-3.42A11.96 11.96 0 0 0 12 0 11.99 11.99 0 0 0 1.33 6.74l4.08 3.06C6.34 6.84 8.93 4.77 12 4.77Z"
            fill="#EA4335"
        />
    </svg>
);
