import { forwardRef, useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import InputError from '@/components/input-error';
import { cn } from '@/lib/utils';

interface InputWithValidationProps extends React.ComponentProps<typeof Input> {
    error?: string;
    validateOnChange?: boolean;
    validator?: (value: string) => string | null;
    debounceMs?: number;
}

const InputWithValidation = forwardRef<HTMLInputElement, InputWithValidationProps>(
    ({ error, validateOnChange = false, validator, debounceMs = 300, onChange, className, ...props }, ref) => {
        const [localError, setLocalError] = useState<string>('');
        const [debouncedValue, setDebouncedValue] = useState<string>('');
        const [isDirty, setIsDirty] = useState(false);

        useEffect(() => {
            setIsDirty(false);
        }, [error]);

        useEffect(() => {
            if (!validateOnChange || !validator || !debouncedValue) {
                return;
            }

            const timer = setTimeout(() => {
                const validationError = validator(debouncedValue);
                setLocalError(validationError || '');
            }, debounceMs);

            return () => clearTimeout(timer);
        }, [debouncedValue, validateOnChange, validator, debounceMs]);

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const value = e.target.value;
            setIsDirty(true);

            if (localError) {
                setLocalError('');
            }

            setDebouncedValue(value);

            if (onChange) {
                onChange(e);
            }
        };

        const displayError = isDirty ? localError : (error || localError);

        return (
            <div className="space-y-2">
                <Input
                    ref={ref}
                    onChange={handleChange}
                    className={cn(
                        displayError && 'border-destructive focus:border-destructive',
                        className
                    )}
                    {...props}
                />
                {displayError && <InputError message={displayError} />}
            </div>
        );
    }
);

InputWithValidation.displayName = 'InputWithValidation';

export { InputWithValidation };
