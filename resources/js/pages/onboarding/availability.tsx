import { Head, useForm, usePage } from '@inertiajs/react';
import { useEffect } from 'react';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem, SharedData } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Onboarding',
        href: '/onboarding/availability',
    },
];

export default function OnboardingAvailability() {
    const { auth } = usePage<SharedData>().props;

    const form = useForm({
        daily_study_hours: (auth.user as any)?.daily_study_hours ?? 2,
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
                        form.post('/onboarding/availability');
                    }}
                >
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

                        <div className="flex justify-end">
                            <Button disabled={form.processing}>Finish</Button>
                        </div>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
