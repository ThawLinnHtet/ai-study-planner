import { Head, useForm, usePage } from '@inertiajs/react';
import { useEffect } from 'react';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Info } from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem, SharedData } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Onboarding',
        href: '/onboarding/availability',
    },
];

export default function OnboardingAvailability() {
    const { auth, flash, errors } = usePage<SharedData>().props;

    const form = useForm({
        daily_study_hours: (auth.user as any)?.daily_study_hours ?? 2,
        productivity_peak: (auth.user as any)?.productivity_peak ?? 'morning',
        learning_style: (auth.user as any)?.learning_style ?? '',
        timezone: (auth.user as any)?.timezone ?? '',
    });

    useEffect(() => {
        if (form.data.timezone) return;
        if (typeof window === 'undefined') return;

        const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const tz = detectedTz === 'Asia/Rangoon' ? 'Asia/Yangon' : detectedTz;

        if (tz) form.setData('timezone', tz);
    }, [form.data.timezone]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Onboarding - Availability" />

            <div className="p-6">
                <Heading
                    title="Availability"
                    description="Tell us how much time you can study"
                />

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        form.post('/onboarding?step=4');
                    }}
                >
                    {/* Validation Error */}
                    {errors.daily_study_hours && (
                        <Alert className="border-red-200 bg-red-50 mb-6">
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                            <AlertDescription className="text-red-800">
                                <div className="font-medium mb-2">⚠️ Cannot Proceed</div>
                                <div>{errors.daily_study_hours}</div>
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Study Hours Warnings (when validation fails) */}
                    {(flash as any)?.validation_failed && (flash as any)?.study_hours_warnings && (
                        <div className="mb-6 space-y-3">
                            {(flash as any).study_hours_warnings.map((warning: string, index: number) => (
                                <Alert key={index} className="border-amber-200 bg-amber-50">
                                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                                    <AlertDescription className="text-amber-800">
                                        {warning}
                                    </AlertDescription>
                                </Alert>
                            ))}

                            {(flash as any)?.study_hours_recommendations && (
                                <Alert className="border-blue-200 bg-blue-50">
                                    <Info className="h-4 w-4 text-blue-600" />
                                    <AlertDescription className="text-blue-800">
                                        <div className="font-medium mb-2">💡 Recommendations:</div>
                                        <ul className="list-disc list-inside space-y-1 text-sm">
                                            {(flash as any).study_hours_recommendations.map((rec: string, index: number) => (
                                                <li key={index}>{rec}</li>
                                            ))}
                                        </ul>
                                        <div className="mt-3 p-2 bg-blue-100 rounded text-xs">
                                            <strong>💡 Tip:</strong> For optimal learning and retention, we recommend 1-6 hours of focused study per day. Quality over quantity!
                                        </div>
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>
                    )}

                    {/* Success message for valid hours */}
                    {!(flash as any)?.validation_failed && (flash as any)?.study_hours_warnings && (
                        <div className="mb-6 space-y-3">
                            {(flash as any).study_hours_warnings.map((warning: string, index: number) => (
                                <Alert key={index} className="border-amber-200 bg-amber-50">
                                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                                    <AlertDescription className="text-amber-800">
                                        {warning}
                                    </AlertDescription>
                                </Alert>
                            ))}

                            {(flash as any)?.study_hours_recommendations && (
                                <Alert className="border-green-200 bg-green-50">
                                    <Info className="h-4 w-4 text-green-600" />
                                    <AlertDescription className="text-green-800">
                                        <div className="font-medium mb-2">✅ Your settings have been optimized</div>
                                        <ul className="list-disc list-inside space-y-1 text-sm">
                                            {(flash as any).study_hours_recommendations.map((rec: string, index: number) => (
                                                <li key={index}>{rec}</li>
                                            ))}
                                        </ul>
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>
                    )}
                    <div className="space-y-4">
                        <div className="grid gap-2">
                            <Label htmlFor="daily_study_hours">
                                Daily study hours
                            </Label>
                            <Input
                                id="daily_study_hours"
                                name="daily_study_hours"
                                type="number"
                                min={1}
                                max={24}
                                value={form.data.daily_study_hours}
                                onChange={(e) =>
                                    form.setData(
                                        'daily_study_hours',
                                        e.target.value,
                                    )
                                }
                            />
                            <InputError
                                message={form.errors.daily_study_hours}
                            />
                            <p className="text-sm text-gray-600">
                                Recommended: 1-6 hours for optimal focus and retention. Maximum: 12 hours.
                            </p>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="productivity_peak">
                                Peak productivity time
                            </Label>
                            <Select
                                value={form.data.productivity_peak}
                                onValueChange={(value) =>
                                    form.setData('productivity_peak', value)
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select your peak time" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="morning">Morning (6AM - 12PM)</SelectItem>
                                    <SelectItem value="afternoon">Afternoon (12PM - 6PM)</SelectItem>
                                    <SelectItem value="evening">Evening (6PM - 10PM)</SelectItem>
                                    <SelectItem value="night">Night (10PM - 6AM)</SelectItem>
                                </SelectContent>
                            </Select>
                            <InputError message={form.errors.productivity_peak} />
                            <p className="text-sm text-gray-600">
                                When do you feel most focused and productive?
                            </p>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="learning_style">
                                Learning style (optional)
                            </Label>
                            <Input
                                id="learning_style"
                                name="learning_style"
                                value={form.data.learning_style}
                                onChange={(e) =>
                                    form.setData(
                                        'learning_style',
                                        e.target.value,
                                    )
                                }
                                placeholder="visual / auditory / reading / kinesthetic"
                            />
                            <InputError message={form.errors.learning_style} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="timezone">Timezone (optional)</Label>
                            <Input
                                id="timezone"
                                name="timezone"
                                value={form.data.timezone}
                                onChange={(e) =>
                                    form.setData('timezone', e.target.value)
                                }
                                placeholder="Asia/Yangon"
                            />
                            <InputError message={form.errors.timezone} />
                        </div>

                        <div className="flex justify-between">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => window.location.href = '/onboarding?step=3'}
                            >
                                Back
                            </Button>
                            <Button disabled={form.processing}>Finish</Button>
                        </div>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
