import { Link, usePage } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { dashboard, login, register } from '@/routes';
import type { SharedData } from '@/types';
import AppLogo from '@/components/app-logo';

export default function LandingNav() {
    const { auth } = usePage<SharedData>().props;

    return (
        <nav className="flex items-center justify-between p-4 max-w-7xl mx-auto">
            <div className="flex items-center">
                <AppLogo />
            </div>

            <div className="flex items-center gap-4">
                {auth.user ? (
                    <Link href={dashboard()}>
                        <Button variant="outline">
                            Dashboard
                        </Button>
                    </Link>
                ) : (
                    <>
                        <Link href={login()}>
                            <Button variant="ghost">
                                Log in
                            </Button>
                        </Link>
                        <Link href={register()}>
                            <Button className="bg-black text-white hover:bg-gray-800">
                                Start Free
                            </Button>
                        </Link>
                    </>
                )}
            </div>
        </nav>
    );
}
