import { usePage } from '@inertiajs/react';
import AppLogoIcon from '@/components/app-logo-icon';
import type { SharedData } from '@/types';

export default function AppLogo() {
    const { name } = usePage<SharedData>().props;

    return (
        <div className="flex items-center gap-2">
            <AppLogoIcon className="h-6 w-auto" />
            <span className="text-base font-bold tracking-tight text-foreground">{name}</span>
        </div>
    );
}
