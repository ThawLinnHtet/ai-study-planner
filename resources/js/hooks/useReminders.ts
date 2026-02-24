import { useState, useEffect, useCallback } from 'react';

type Reminder = {
    id: number;
    type: string;
    title: string;
    message: string;
    payload: Record<string, any> | null;
    send_at: string;
    status: string;
};

const getCSRFToken = (): string => {
    return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
};

export function useReminders(pollIntervalMs = 60000) {
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);

    const fetchReminders = useCallback(async () => {
        try {
            setLoading(true);
            const response = await fetch('/reminders', {
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'same-origin',
            });

            if (response.ok) {
                const data = await response.json();
                setReminders(data.reminders);
                setUnreadCount(data.unread_count);
            }
        } catch (error) {
            console.warn('Failed to fetch reminders:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    // Poll for reminders
    useEffect(() => {
        fetchReminders();
        const interval = setInterval(fetchReminders, pollIntervalMs);
        return () => clearInterval(interval);
    }, [fetchReminders, pollIntervalMs]);

    const markRead = useCallback(async (reminderId: number) => {
        try {
            await fetch(`/reminders/${reminderId}/read`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': getCSRFToken(),
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'same-origin',
            });
            setReminders(prev => prev.map(r => r.id === reminderId ? { ...r, status: 'read' } : r));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.warn('Failed to mark reminder as read:', error);
        }
    }, []);

    const dismissReminder = useCallback(async (reminderId: number) => {
        try {
            await fetch(`/reminders/${reminderId}/dismiss`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': getCSRFToken(),
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'same-origin',
            });
            setReminders(prev => prev.filter(r => r.id !== reminderId));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.warn('Failed to dismiss reminder:', error);
        }
    }, []);

    const dismissAll = useCallback(async () => {
        try {
            await fetch('/reminders/dismiss-all', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': getCSRFToken(),
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'same-origin',
            });
            setReminders([]);
            setUnreadCount(0);
        } catch (error) {
            console.warn('Failed to dismiss all reminders:', error);
        }
    }, []);

    return {
        reminders,
        unreadCount,
        loading,
        fetchReminders,
        markRead,
        dismissReminder,
        dismissAll,
    };
}
