import { Form, Head } from '@inertiajs/react';
import InputError from '@/components/input-error';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputWithValidation } from '@/components/ui/input-with-validation';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { PasswordStrength } from '@/components/ui/password-strength';
import AuthLayout from '@/layouts/auth-layout';
import { login } from '@/routes';
import { store } from '@/routes/register';
import { ArrowRight, BookOpen, Sparkles, Target, Trophy, Users } from 'lucide-react';
import { useState } from 'react';

export default function Register() {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isPasswordFocused, setIsPasswordFocused] = useState(false);

    const handleGoogleLogin = () => {
        window.location.href = '/auth/google';
    };

    // Real-time validators
    const validateName = (value: string) => {
        if (!value.trim()) return 'Name is required';
        if (value.trim().length < 2) return 'Name must be at least 2 characters';
        if (value.trim().length > 255) return 'Name must be less than 255 characters';
        return null;
    };

    const validateEmail = (value: string) => {
        if (!value.trim()) return 'Email is required';
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) return 'Please enter a valid email address';
        if (value.length > 255) return 'Email must be less than 255 characters';
        return null;
    };

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

    return (
        <AuthLayout
            title="Start your learning journey"
            description="Join thousands of students building consistent habits with AI guidance"
        >
            <Head title="Register" />

            <div className="grid gap-6 animate-fade-in-up">
                <Card className="border border-border/50 w-full shadow-lg backdrop-blur-sm bg-card/95">
                    <CardHeader className="text-center pt-8">
                        <CardTitle className="text-2xl font-bold tracking-tight">Create your account</CardTitle>
                        <CardDescription className="text-base mt-2">
                            It takes less than a minute to personalize your learning dashboard
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form
                            action={store().url}
                            method={store().method}
                            resetOnSuccess={['password', 'password_confirmation']}
                            disableWhileProcessing
                            className="grid gap-5"
                        >
                            {({ processing, errors }) => (
                                <>
                                    <div className="grid gap-2">
                                        <Label htmlFor="name">Full name</Label>
                                        <InputWithValidation
                                            id="name"
                                            type="text"
                                            required
                                            autoFocus
                                            tabIndex={1}
                                            autoComplete="name"
                                            name="name"
                                            placeholder="Taylor Jordan"
                                            className="h-11"
                                            error={errors.name}
                                            validateOnChange={true}
                                            validator={validateName}
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="email">Email address</Label>
                                        <InputWithValidation
                                            id="email"
                                            type="email"
                                            required
                                            tabIndex={2}
                                            autoComplete="email"
                                            name="email"
                                            placeholder="you@example.com"
                                            className="h-11"
                                            error={errors.email}
                                            validateOnChange={true}
                                            validator={validateEmail}
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="password">Password</Label>
                                        <InputWithValidation
                                            id="password"
                                            type="password"
                                            required
                                            tabIndex={3}
                                            autoComplete="new-password"
                                            name="password"
                                            placeholder="Enter your password"
                                            className="h-11"
                                            error={errors.password}
                                            onFocus={() => setIsPasswordFocused(true)}
                                            onBlur={() => setIsPasswordFocused(false)}
                                            onChange={(e) => setPassword(e.target.value)}
                                        />
                                        {isPasswordFocused && <PasswordStrength password={password} />}
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="password_confirmation">Confirm password</Label>
                                        <InputWithValidation
                                            id="password_confirmation"
                                            type="password"
                                            required
                                            tabIndex={4}
                                            autoComplete="new-password"
                                            name="password_confirmation"
                                            placeholder="Repeat your password"
                                            className="h-11"
                                            error={errors.password_confirmation}
                                            validateOnChange={true}
                                            validator={validateConfirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                        />
                                    </div>

                                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                                        <Checkbox id="terms" required tabIndex={5} className="mt-1" />
                                        <label htmlFor="terms" className="leading-relaxed">
                                            I agree to the{' '}
                                            <TextLink href="/terms" className="font-medium text-primary">
                                                Terms of Service
                                            </TextLink>{' '}
                                            and{' '}
                                            <TextLink href="/privacy" className="font-medium text-primary">
                                                Privacy Policy
                                            </TextLink>
                                        </label>
                                    </div>

                                    <Button
                                        type="submit"
                                        className="h-12 w-full bg-primary text-primary-foreground text-base font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
                                        tabIndex={6}
                                        data-test="register-user-button"
                                    >
                                        {processing && <Spinner className="mr-2 h-4 w-4" />}
                                        Create account
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

                        <p className="mt-6 text-center text-sm text-muted-foreground">
                            Already have an account?{' '}
                            <TextLink href={login()} className="font-semibold text-primary">
                                Sign in
                            </TextLink>
                        </p>
                    </CardContent>
                </Card>
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
