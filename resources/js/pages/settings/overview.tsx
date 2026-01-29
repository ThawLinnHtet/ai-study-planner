import { Head } from '@inertiajs/react';
import Heading from '@/components/heading';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { overview } from '@/routes/settings';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Settings',
        href: overview().url,
    },
];

export default function Overview() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Settings" />

            <SettingsLayout>
                <div className="space-y-6">
                    <Heading
                        variant="small"
                        title="Overview"
                        description="Account and application settings"
                    />
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}
