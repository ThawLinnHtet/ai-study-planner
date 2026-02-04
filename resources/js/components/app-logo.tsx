import { usePage } from '@inertiajs/react';
import AppLogoIcon from '@/components/app-logo-icon';
import type { SharedData } from '@/types';

export default function AppLogo() {
    const { name } = usePage<SharedData>().props;

    return (
        <div className="flex items-center gap-2">
            <AppLogoIcon className="size-6 fill-current text-black dark:text-white" />
            <span className="text-sm font-medium text-foreground">{name}</span>
        </div>
    );
}
