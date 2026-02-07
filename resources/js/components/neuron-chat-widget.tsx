import { useState, useEffect, useRef } from 'react';
import { usePage } from '@inertiajs/react';
import { motion } from 'framer-motion';
import { Bot, Sparkles } from 'lucide-react';
import NeuronChatPanel, {
    type NeuronChatMessage,
    type NeuronChatThread,
} from '@/components/neuron-chat-panel';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { SharedData } from '@/types';

type Props = {
    className?: string;
};

// Helper functions for sessionStorage
const getUserStorageKey = (userId: number | string) => `neuron-chat-session-${userId}`;

const saveToSession = (userId: number | string, data: { threadId: string; threads: NeuronChatThread[]; messages: NeuronChatMessage[] }) => {
    try {
        sessionStorage.setItem(getUserStorageKey(userId), JSON.stringify(data));
    } catch (e) {
        console.error('Failed to save to sessionStorage:', e);
    }
};

const loadFromSession = (userId: number | string): { threadId: string; threads: NeuronChatThread[]; messages: NeuronChatMessage[] } | null => {
    try {
        const data = sessionStorage.getItem(getUserStorageKey(userId));
        if (data) {
            return JSON.parse(data);
        }
    } catch (e) {
        console.error('Failed to load from sessionStorage:', e);
    }
    return null;
};

const clearUserSession = (userId: number | string) => {
    try {
        sessionStorage.removeItem(getUserStorageKey(userId));
    } catch (e) {
        console.error('Failed to clear sessionStorage:', e);
    }
};

export default function NeuronChatWidget({ className }: Props) {
    const page = usePage<SharedData>();
    const user = page.props.auth?.user;
    const [open, setOpen] = useState(false);
    const [chatData, setChatData] = useState<{
        threadId: string;
        threads: NeuronChatThread[];
        messages: NeuronChatMessage[];
    }>(() => {
        if (!user) {
            return { threadId: '', threads: [], messages: [] };
        }

        // Try to load from sessionStorage first
        const stored = loadFromSession(user.id);
        // Use sessionStorage if it has ANY chat messages (main persistence indicator)
        if (stored && stored.messages.length > 0) {
            return stored;
        }

        // Otherwise use page props
        const initialThreadId = (page.props as unknown as { threadId?: string }).threadId || '';
        const initialThreads = (page.props as unknown as { threads?: NeuronChatThread[] }).threads || [];
        const initialMessages = (page.props as unknown as { messages?: NeuronChatMessage[] }).messages || [];

        const data = { threadId: initialThreadId, threads: initialThreads, messages: initialMessages };
        return data;
    });

    if (!user) return null;

    // Track previous user ID to detect user changes
    const previousUserIdRef = useRef<number | string | null>(null);

    // Clear and reset when user changes
    useEffect(() => {
        if (!user) return;

        // If user changed, clear previous user's session and reset state
        if (previousUserIdRef.current !== null && previousUserIdRef.current !== user.id) {
            // Clear previous user's session (optional cleanup)
            if (previousUserIdRef.current) {
                clearUserSession(previousUserIdRef.current);
            }

            // Reset chat data for new user
            const initialThreadId = (page.props as unknown as { threadId?: string }).threadId || '';
            const initialThreads = (page.props as unknown as { threads?: NeuronChatThread[] }).threads || [];
            const initialMessages = (page.props as unknown as { messages?: NeuronChatMessage[] }).messages || [];

            setChatData({ threadId: initialThreadId, threads: initialThreads, messages: initialMessages });
        }

        previousUserIdRef.current = user.id;
    }, [user, page.props]);

    // Save initial data to sessionStorage on first load if no session exists
    useEffect(() => {
        if (!user) return;
        const stored = loadFromSession(user.id);
        if (!stored) {
            saveToSession(user.id, chatData);
        }
    }, [user]); // Run when user changes

    // Save to sessionStorage whenever chatData changes
    useEffect(() => {
        if (!user) return;
        saveToSession(user.id, chatData);
    }, [chatData, user]);

    // Cleanup when user logs out (user becomes null)
    useEffect(() => {
        if (user === null && previousUserIdRef.current !== null) {
            // User logged out, clear their session
            clearUserSession(previousUserIdRef.current);
            previousUserIdRef.current = null;
        }
    }, [user]);

    return (
        <div className={cn('fixed bottom-5 right-5 z-40', className)}>
            <Sheet open={open} onOpenChange={setOpen}>
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                >
                    <Button
                        type="button"
                        size="icon-lg"
                        className={cn(
                            'h-12 w-12 rounded-2xl shadow-lg',
                            'bg-gradient-to-br from-primary via-fuchsia-500 to-cyan-500',
                            'hover:opacity-95',
                        )}
                        onClick={() => setOpen(true)}
                    >
                        <span className="sr-only">Open Neuron Chat</span>
                        <Bot className="text-white" />
                    </Button>

                    <motion.div
                        className="pointer-events-none absolute -right-2 -top-2"
                        animate={{ rotate: [0, 8, 0], scale: [1, 1.05, 1] }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    >
                        <Sparkles className="h-5 w-5 text-fuchsia-400 drop-shadow" />
                    </motion.div>
                </motion.div>

                <SheetContent side="right" className="w-[420px] max-w-[92vw] p-0 [&>button]:top-4">
                    <SheetHeader className="sr-only">
                        <SheetTitle>Neuron Chat</SheetTitle>
                        <SheetDescription>
                            AI study assistant chat interface for personalized learning guidance
                        </SheetDescription>
                    </SheetHeader>
                    <div className="h-dvh max-h-dvh">
                        <NeuronChatPanel
                            initialThreadId={chatData.threadId}
                            initialThreads={chatData.threads}
                            initialMessages={chatData.messages}
                            variant="widget"
                            className="h-full rounded-none border-0"
                            onMessagesChange={(newMessages) => {
                                // Update widget state when messages change in panel
                                setChatData(prev => ({ ...prev, messages: newMessages }));
                            }}
                        />
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}
