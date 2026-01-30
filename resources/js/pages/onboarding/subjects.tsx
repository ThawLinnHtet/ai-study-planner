import { Head, useForm } from '@inertiajs/react';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

type Subject = {
    id: number;
    name: string;
    exam_date: string | null;
};

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Onboarding',
        href: '/onboarding/subjects',
    },
];

export default function OnboardingSubjects({
    subjects: existingSubjects,
}: {
    subjects: Subject[];
}) {
    const defaultText = existingSubjects.map((s) => s.name).join('\n');

    const form = useForm({
        subjects_text: defaultText,
    });

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Onboarding - Subjects" />

            <div className="p-6">
                <Heading
                    title="Subjects"
                    description="Add the subjects you want to study"
                />

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        form.post('/onboarding/subjects');
                    }}
                >
                    <div className="space-y-4">
                        <div className="grid gap-2">
                            <textarea
                                name="subjects_text"
                                value={form.data.subjects_text}
                                onChange={(e) =>
                                    form.setData('subjects_text', e.target.value)
                                }
                                rows={8}
                                placeholder="One subject per line"
                                className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs outline-none focus-visible:ring-[3px] md:text-sm"
                            />
                            <InputError message={form.errors.subjects_text} />
                        </div>

                        <div className="flex justify-end">
                            <Button disabled={form.processing}>Next</Button>
                        </div>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
