import { usePage } from '@inertiajs/react';
import { useEffect } from 'react';
import { Toaster, toast } from 'sonner';
import type { ReactNode } from 'react';
import type { SharedData } from '@/types';
import AppLogo from '@/components/app-logo';

interface OnboardingLayoutProps {
    children: ReactNode;
}

export default function OnboardingLayout({
    children,
}: OnboardingLayoutProps) {
    const { props } = usePage<SharedData>();
    const flash = props.flash;

    useEffect(() => {
        if (!flash) return;

        if (flash.success) {
            toast.success(flash.success as string, { id: `success-${flash.success}` });
        }
        if (flash.error) {
            toast.error(flash.error as string, { id: `error-${flash.error}` });
        }
        if (flash.info) {
            toast.info(flash.info as string, { id: `info-${flash.info}` });
        }
        if (flash.warning) {
            toast.warning(flash.warning as string, { id: `warning-${flash.warning}` });
        }
    }, [flash]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
            {/* Background Pattern */}
            <div className="fixed inset-0 -z-10 overflow-hidden">
                <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-gradient-to-br from-blue-400/20 to-purple-600/20 blur-3xl" />
                <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-gradient-to-tr from-green-400/20 to-blue-600/20 blur-3xl" />
            </div>

            {/* Main Content */}
            <div className="relative flex min-h-screen flex-col">
                {/* Top Navigation */}
                <header className="border-b border-border/40 bg-white/50 backdrop-blur-sm dark:bg-slate-900/50">
                    <div className="container mx-auto flex h-16 items-center justify-between px-4">
                        <div className="flex items-center gap-2">
                            <AppLogo />
                        </div>

                        <div className="flex items-center gap-4">
                            <span className="text-sm text-muted-foreground">
                                Setting up your personalized learning experience
                            </span>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 container mx-auto px-4 py-8">
                    {children}
                </main>

                {/* Footer */}
                <footer className="border-t border-border/40 bg-white/50 backdrop-blur-sm dark:bg-slate-900/50 py-4">
                    <div className="container mx-auto px-4 text-center">
                        <p className="text-xs text-muted-foreground">
                            Powered by AI • Your data is secure and private
                        </p>
                    </div>
                </footer>

                <Toaster position="top-right" richColors closeButton />
            </div>
        </div>
    );
}
