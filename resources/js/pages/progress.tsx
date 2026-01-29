import { Head } from '@inertiajs/react';
import Heading from '@/components/heading';
import AppLayout from '@/layouts/app-layout';
import { progress } from '@/routes';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Progress',
        href: progress().url,
    },
];

export default function Progress() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Progress" />

            <div className="p-6">
                <Heading
                    title="Progress"
                    description="See your completed sessions and overall progress"
                />
            </div>
        </AppLayout>
    );
}
