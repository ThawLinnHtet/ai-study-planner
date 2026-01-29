import { Head } from '@inertiajs/react';
import Heading from '@/components/heading';
import AppLayout from '@/layouts/app-layout';
import { quizzes } from '@/routes';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Quizzes',
        href: quizzes().url,
    },
];

export default function Quizzes() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Quizzes" />

            <div className="p-6">
                <Heading
                    title="Quizzes"
                    description="Test your knowledge and track quiz results"
                />
            </div>
        </AppLayout>
    );
}
