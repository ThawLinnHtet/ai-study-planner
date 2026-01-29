import { Head } from '@inertiajs/react';
import Heading from '@/components/heading';
import AppLayout from '@/layouts/app-layout';
import { aiTutor } from '@/routes';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'AI Tutor',
        href: aiTutor().url,
    },
];

export default function AiTutor() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="AI Tutor" />

            <div className="p-6">
                <Heading
                    title="AI Tutor"
                    description="Ask questions and get help while studying"
                />
            </div>
        </AppLayout>
    );
}
