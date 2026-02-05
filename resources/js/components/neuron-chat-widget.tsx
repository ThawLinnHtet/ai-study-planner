import { useState, useEffect } from 'react';
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

const STORAGE_KEY = 'neuron-chat-session';

// Helper functions for sessionStorage
const saveToSession = (data: { threadId: string; threads: NeuronChatThread[]; messages: NeuronChatMessage[] }) => {
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.error('Failed to save to sessionStorage:', e);
    }
};

const loadFromSession = (): { threadId: string; threads: NeuronChatThread[]; messages: NeuronChatMessage[] } | null => {
    try {
        const data = sessionStorage.getItem(STORAGE_KEY);
        if (data) {
            return JSON.parse(data);
        }
    } catch (e) {
        console.error('Failed to load from sessionStorage:', e);
    }
    return null;
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
        // Try to load from sessionStorage first
        const stored = loadFromSession();
        // Use sessionStorage if it has ANY chat messages (main persistence indicator)
        if (stored && stored.messages.length > 0) {
            return stored;
        }

        // Otherwise use page props
        const initialThreadId = (page.props as unknown as { threadId?: string }).threadId || '';
        const initialThreads = (page.props as unknown as { threads?: NeuronChatThread[] }).threads || [];
        const initialMessages = (page.props as unknown as { messages?: NeuronChatMessage[] }).messages || [];

        const data = { threadId: initialThreadId, threads: initialThreads, messages: initialMessages };
        saveToSession(data);
        return data;
    });

    if (!user) return null;

    // Save to sessionStorage whenever chatData changes
    useEffect(() => {
        saveToSession(chatData);
    }, [chatData]);

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

                <SheetContent side="right" className="w-[420px] max-w-[92vw] p-0">
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
                                setChatData(prev => {
                                    const updated = { ...prev, messages: newMessages };
                                    saveToSession(updated);
                                    return updated;
                                });
                            }}
                        />
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}
