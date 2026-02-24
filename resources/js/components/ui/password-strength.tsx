import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Check, X } from 'lucide-react';

interface PasswordStrengthProps {
    password: string;
    className?: string;
}

export function PasswordStrength({ password, className }: PasswordStrengthProps) {
    const requirements = [
        { label: 'At least 8 characters', test: (pwd: string) => pwd.length >= 8 },
        { label: 'One uppercase letter', test: (pwd: string) => /[A-Z]/.test(pwd) },
        { label: 'One lowercase letter', test: (pwd: string) => /[a-z]/.test(pwd) },
        { label: 'One number', test: (pwd: string) => /\d/.test(pwd) },
    ];

    const passedRequirements = requirements.filter(req => req.test(password)).length;
    const strengthPercentage = (passedRequirements / requirements.length) * 100;

    const getStrengthColor = () => {
        if (strengthPercentage <= 20) return 'bg-red-500';
        if (strengthPercentage <= 40) return 'bg-orange-500';
        if (strengthPercentage <= 60) return 'bg-yellow-500';
        if (strengthPercentage <= 80) return 'bg-lime-500';
        return 'bg-green-500';
    };

    const getStrengthText = () => {
        if (strengthPercentage <= 20) return 'Very Weak';
        if (strengthPercentage <= 40) return 'Weak';
        if (strengthPercentage <= 60) return 'Fair';
        if (strengthPercentage <= 80) return 'Good';
        return 'Strong';
    };

    const getStrengthTextColor = () => {
        if (strengthPercentage <= 40) return 'text-red-600 dark:text-red-400';
        if (strengthPercentage <= 60) return 'text-yellow-600 dark:text-yellow-400';
        return 'text-green-600 dark:text-green-400';
    };

    if (!password) return null;

    return (
        <div className={cn('space-y-2', className)}>
            <div className="flex items-center justify-between">
                <span className="text-xs font-medium">Password Strength</span>
                <span className={cn('text-xs font-medium', getStrengthTextColor())}>
                    {getStrengthText()}
                </span>
            </div>
            <Progress value={strengthPercentage} className="h-2" />
            <div className="space-y-1">
                {requirements.map((req, index) => {
                    const passed = req.test(password);
                    return (
                        <div key={index} className="flex items-center gap-2 text-xs">
                            {passed ? (
                                <Check className="h-3 w-3 text-green-500" />
                            ) : (
                                <X className="h-3 w-3 text-muted-foreground" />
                            )}
                            <span className={cn(passed ? 'text-foreground' : 'text-muted-foreground')}>
                                {req.label}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
