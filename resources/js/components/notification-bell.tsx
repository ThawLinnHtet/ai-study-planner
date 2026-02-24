import { Bell, X, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useReminders } from '@/hooks/useReminders';
import { cn } from '@/lib/utils';

export function NotificationBell() {
    const [open, setOpen] = useState(false);
    const { reminders, unreadCount, markRead, dismissReminder, dismissAll, fetchReminders } = useReminders();
    const isDebug = Boolean((window as any)?.APP_DEBUG ?? import.meta.env.VITE_APP_DEBUG ?? true);

    const seedDemoReminders = async () => {
        try {
            const response = await fetch('/reminders/demo', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                credentials: 'same-origin',
            });

            if (response.ok) {
                fetchReminders();
            }
        } catch (error) {
            console.warn('Failed to seed demo reminders:', error);
        }
    };

    return (
        <div className="relative">
            <Button
                variant="ghost"
                size="icon"
                className="group relative h-9 w-9 cursor-pointer"
                onClick={() => setOpen(!open)}
            >
                <Bell className="!size-5 opacity-80 group-hover:opacity-100" />
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </Button>

            {open && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setOpen(false)}
                    />

                    {/* Dropdown */}
                    <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border bg-white shadow-lg dark:bg-neutral-900 dark:border-neutral-700">
                        <div className="flex items-center justify-between border-b px-4 py-3 dark:border-neutral-700">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                Notifications
                            </h3>
                            {reminders.length > 0 && (
                                <button
                                    onClick={() => dismissAll()}
                                    className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                >
                                    Clear all
                                </button>
                            )}
                        </div>

                        {isDebug && (
                            <div className="px-4 py-2 border-b dark:border-neutral-700 bg-amber-50/70 dark:bg-neutral-800/60">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full flex items-center gap-2 text-amber-700 dark:text-amber-300"
                                    onClick={seedDemoReminders}
                                >
                                    <Wand2 className="w-4 h-4" />
                                    Create sample reminders
                                </Button>
                            </div>
                        )}

                        <div className="max-h-80 overflow-y-auto">
                            {reminders.length === 0 ? (
                                <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                                    No notifications
                                </div>
                            ) : (
                                reminders.map((reminder) => (
                                    <div
                                        key={reminder.id}
                                        className={cn(
                                            "group flex items-start gap-3 border-b px-4 py-3 transition-colors dark:border-neutral-700",
                                            reminder.status !== 'read' ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-gray-50 dark:hover:bg-neutral-800"
                                        )}
                                    >
                                        <div
                                            className="flex-1 cursor-pointer"
                                            onClick={() => reminder.status !== 'read' && markRead(reminder.id)}
                                        >
                                            <div className="flex items-center gap-2">
                                                <p className={cn(
                                                    "text-sm font-medium text-gray-900 dark:text-gray-100",
                                                    reminder.status !== 'read' && "font-bold"
                                                )}>
                                                    {reminder.title}
                                                </p>
                                                {reminder.status !== 'read' && (
                                                    <span className="h-2 w-2 rounded-full bg-primary" />
                                                )}
                                            </div>
                                            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                                                {reminder.message}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => dismissReminder(reminder.id)}
                                            className="mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded"
                                            title="Dismiss"
                                        >
                                            <X className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
