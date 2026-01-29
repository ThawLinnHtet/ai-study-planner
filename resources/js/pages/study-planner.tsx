import { Head } from '@inertiajs/react';
import Heading from '@/components/heading';
import AppLayout from '@/layouts/app-layout';
import { studyPlanner } from '@/routes';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Study Planner',
        href: studyPlanner().url,
    },
];

export default function StudyPlanner() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Study Planner" />

            <div className="p-6">
                <Heading
                    title="Study Planner"
                    description="Create and manage your study schedules"
                />
            </div>
        </AppLayout>
    );
}
