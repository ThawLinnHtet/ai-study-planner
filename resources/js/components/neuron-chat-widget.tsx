import { useState, useEffect } from 'react';
import { usePage } from '@inertiajs/react';
import { motion } from 'framer-motion';
import { Bot, Sparkles } from 'lucide-react';
import NeuronChatPanel, {
    type NeuronChatMessage,
    type NeuronChatThread,
} from '@/components/neuron-chat-panel';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { SharedData } from '@/types';

type Props = {
    className?: string;
};

export default function NeuronChatWidget({ className }: Props) {
    const page = usePage<SharedData>();
    const user = page.props.auth?.user;
    const [open, setOpen] = useState(false);
    const [chatData, setChatData] = useState({
        threadId: '',
        threads: [] as NeuronChatThread[],
        messages: [] as NeuronChatMessage[],
    });

    if (!user) return null;

    // Initialize chat data from page props
    useEffect(() => {
        const initialThreadId = (page.props as unknown as {
            threadId?: string;
        }).threadId || '';

        const initialThreads = (page.props as unknown as {
            threads?: NeuronChatThread[];
        }).threads || [];

        const initialMessages = (page.props as unknown as {
            messages?: NeuronChatMessage[];
        }).messages || [];

        setChatData({
            threadId: initialThreadId,
            threads: initialThreads,
            messages: initialMessages,
        });
    }, [page.props]);

    // Refresh chat data when widget opens
    useEffect(() => {
        if (open) {
            // Fetch latest chat data when opening
            fetch('/ai-tutor/threads')
                .then(res => res.json())
                .then(data => {
                    const latestThread = data.threads?.[0];
                    if (latestThread) {
                        return fetch(`/ai-tutor/threads/${latestThread.thread_id}`)
                            .then(res => res.json())
                            .then(messageData => {
                                setChatData({
                                    threadId: latestThread.thread_id,
                                    threads: data.threads || [],
                                    messages: messageData.messages || [],
                                });
                            });
                    }
                })
                .catch(console.error);
        }
    }, [open]);

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
                    </SheetHeader>
                    <div className="h-dvh max-h-dvh">
                        <NeuronChatPanel
                            initialThreadId={chatData.threadId}
                            initialThreads={chatData.threads}
                            initialMessages={chatData.messages}
                            variant="widget"
                            className="h-full rounded-none border-0"
                        />
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}
