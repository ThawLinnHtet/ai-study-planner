import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Send, Trash2, Bot } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

export type NeuronChatThread = {
    thread_id: string;
    updated_at?: string;
    preview?: string;
};

export type NeuronChatMessage = {
    id?: number;
    role: 'user' | 'assistant' | 'system';
    content: string;
    created_at?: string;
};

type Props = {
    initialThreadId?: string;
    initialThreads?: NeuronChatThread[];
    initialMessages?: NeuronChatMessage[];
    className?: string;
    variant?: 'page' | 'widget';
    onMessagesChange?: (messages: NeuronChatMessage[]) => void;
};

const SUGGESTIONS: string[] = [
    'What should I study today based on my plan?',
    'Summarize my recent progress and what to fix next.',
    'Turn today\'s sessions into a 3-step action plan.',
    'Quiz me on the topic I studied most recently.',
];

function getCsrfToken() {
    return (
        document
            .querySelector('meta[name="csrf-token"]')
            ?.getAttribute('content') || ''
    );
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': getCsrfToken(),
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Request failed');
    }

    return (await res.json()) as T;
}

async function getJson<T>(url: string): Promise<T> {
    const res = await fetch(url, {
        headers: {
            'Accept': 'application/json',
        },
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Request failed');
    }

    return (await res.json()) as T;
}

async function deleteJson(url: string): Promise<void> {
    const res = await fetch(url, {
        method: 'DELETE',
        headers: {
            'X-CSRF-TOKEN': getCsrfToken(),
        },
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Request failed');
    }
}

export default function NeuronChatPanel({
    initialThreadId,
    initialThreads = [],
    initialMessages = [],
    className,
    variant = 'widget',
    onMessagesChange,
}: Props) {
    const [threadId, setThreadId] = useState(initialThreadId);
    const [threads, setThreads] = useState<NeuronChatThread[]>(initialThreads);
    const [messages, setMessages] = useState<NeuronChatMessage[]>(initialMessages);
    const [draft, setDraft] = useState('');
    const [sending, setSending] = useState(false);
    const [loadingThread, setLoadingThread] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const scrollRef = useRef<HTMLDivElement | null>(null);

    const hasAnyMessages = messages.some((m) => m.role !== 'system');

    const headerSubtitle = useMemo(() => {
        if (variant === 'page') return 'Ask anything. Neuron uses your plan + progress to answer.';
        return 'Your context-aware AI tutor.';
    }, [variant]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    // Notify parent component when messages change (for persistence)
    const prevMessagesRef = useRef(messages);
    useEffect(() => {
        if (onMessagesChange && JSON.stringify(prevMessagesRef.current) !== JSON.stringify(messages)) {
            onMessagesChange(messages);
            prevMessagesRef.current = messages;
        }
    }, [messages, onMessagesChange]);

    const refreshThreads = async () => {
        try {
            const data = await getJson<{ threads: NeuronChatThread[] }>('/ai-tutor/threads');
            setThreads(data.threads);
        } catch (e) {
            console.error('Failed to refresh threads:', e);
        }
    };

    const openThread = async (nextThreadId: string) => {
        if (nextThreadId === threadId) return;

        setLoadingThread(true);
        setError(null);
        try {
            const data = await getJson<{ thread_id: string; messages: NeuronChatMessage[] }>(
                `/ai-tutor/threads/${encodeURIComponent(nextThreadId)}`,
            );
            setThreadId(data.thread_id);
            setMessages(data.messages || []);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load thread');
        } finally {
            setLoadingThread(false);
        }
    };

    const newThread = async () => {
        setError(null);
        setLoadingThread(true);
        try {
            const data = await postJson<{ thread_id: string }>('/ai-tutor/new-thread', {});
            setThreadId(data.thread_id);
            setMessages([]);
            await refreshThreads();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to create thread');
        } finally {
            setLoadingThread(false);
        }
    };

    const deleteThread = async (idToDelete: string) => {
        try {
            await deleteJson(`/ai-tutor/threads/${encodeURIComponent(idToDelete)}`);
            await refreshThreads();
            if (idToDelete === threadId) {
                await newThread();
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to delete thread');
        }
    };

    const handleSend = async () => {
        const trimmed = draft.trim();
        if (!trimmed) return;

        setError(null);
        setDraft('');

        const optimisticUser: NeuronChatMessage = {
            role: 'user',
            content: trimmed,
        };
        setMessages((prev) => [...prev, optimisticUser]);

        setSending(true);
        try {
            const data = await postJson<{ thread_id: string; assistant: { role: 'assistant'; content: string } }>(
                '/ai-tutor/send',
                {
                    thread_id: threadId || null,
                    message: trimmed,
                },
            );

            if (data.thread_id && data.thread_id !== threadId) {
                setThreadId(data.thread_id);
            }

            setMessages((prev) => [
                ...prev,
                {
                    role: 'assistant',
                    content: data.assistant?.content || '',
                },
            ]);

            await refreshThreads();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to send message');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className={cn('flex h-full flex-col bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900', className)}>
            {/* Premium Header */}
            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50 shadow-sm">
                <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full blur-sm opacity-75 animate-pulse" />
                            <div className="relative h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                                <Bot className="h-4 w-4 text-white" />
                            </div>
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Neuron</h2>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                {variant === 'page' ? 'AI Study Assistant' : 'Your AI Tutor'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Thread Tabs - Only show if more than 1 thread */}
                {threads.length > 1 && (
                    <div className="px-4 pb-3">
                        <div className="flex gap-2 overflow-x-auto">
                            {threads.slice(0, 3).map((t) => (
                                <div
                                    key={t.thread_id}
                                    onClick={() => openThread(t.thread_id)}
                                    className={cn(
                                        'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-all backdrop-blur-sm cursor-pointer',
                                        t.thread_id === threadId
                                            ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/25'
                                            : 'bg-white/70 dark:bg-slate-700/70 hover:bg-white/90 dark:hover:bg-slate-700/90 text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-slate-600/50',
                                    )}
                                >
                                    <span className="max-w-[100px] truncate font-medium">
                                        {t.preview || 'New chat'}
                                    </span>
                                    <span
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            deleteThread(t.thread_id);
                                        }}
                                        className="opacity-70 hover:opacity-100 transition-opacity cursor-pointer"
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Messages Area */}
            <div className="flex flex-1 min-h-0">
                <div ref={scrollRef} className="flex-1 overflow-y-auto">
                    {loadingThread && (
                        <div className="flex items-center justify-center h-32">
                            <div className="flex items-center gap-3 px-4 py-3 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-full shadow-lg">
                                <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                <span className="text-sm text-slate-600 dark:text-slate-300">Loading...</span>
                            </div>
                        </div>
                    )}

                    {/* Empty State */}
                    {!hasAnyMessages && !loadingThread && (
                        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                            <div className="relative mb-6">
                                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl blur-xl opacity-30 animate-pulse" />
                                <div className="relative bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-200/50 dark:border-slate-700/50">
                                    <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                                        <Bot className="h-8 w-8 text-white" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Ready to help you study</h3>
                                    <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
                                        I'll use your study plan, progress, and recent sessions to give personalized guidance
                                    </p>
                                    <div className="flex flex-col gap-2">
                                        {SUGGESTIONS.slice(0, 3).map((s) => (
                                            <button
                                                key={s}
                                                type="button"
                                                onClick={() => {
                                                    setDraft(s);
                                                    setTimeout(() => handleSend(), 0);
                                                }}
                                                disabled={sending}
                                                className="text-left px-4 py-3 rounded-xl bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 hover:from-blue-100 hover:to-purple-100 dark:hover:from-blue-900/30 dark:hover:to-purple-900/30 border border-blue-200/50 dark:border-blue-800/50 text-sm text-slate-700 dark:text-slate-200 transition-all shadow-sm"
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Messages */}
                    <div className="p-6 space-y-6">
                        {messages
                            .filter((m) => m.role !== 'system')
                            .map((m, idx) => (
                                <motion.div
                                    key={`${m.role}-${idx}-${m.content.slice(0, 16)}`}
                                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    transition={{ duration: 0.4, ease: "easeOut" }}
                                    className={cn(
                                        'flex gap-4',
                                        m.role === 'user' ? 'justify-end' : 'justify-start',
                                    )}
                                >
                                    {m.role === 'assistant' && (
                                        <div className="flex-shrink-0">
                                            <div className="relative">
                                                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full blur-sm opacity-75" />
                                                <div className="relative h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                                                    <Bot className="h-5 w-5 text-white" />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <div
                                        className={cn(
                                            'max-w-[75%] rounded-2xl px-5 py-4 text-sm leading-relaxed shadow-xl backdrop-blur-sm',
                                            m.role === 'user'
                                                ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-blue-500/25'
                                                : 'bg-white/90 dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 border border-slate-200/50 dark:border-slate-700/50',
                                        )}
                                    >
                                        <div className="whitespace-pre-wrap break-words">{m.content}</div>
                                    </div>
                                    {m.role === 'user' && (
                                        <div className="flex-shrink-0">
                                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center shadow-lg">
                                                <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                </svg>
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            ))}

                        {sending && (
                            <div className="flex gap-4 justify-start">
                                <div className="flex-shrink-0">
                                    <div className="relative">
                                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full blur-sm opacity-75" />
                                        <div className="relative h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                                            <Bot className="h-5 w-5 text-white" />
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white/90 dark:bg-slate-800/90 rounded-2xl px-5 py-4 shadow-xl backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50">
                                    <div className="flex items-center gap-3">
                                        <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                        <span className="text-sm text-slate-600 dark:text-slate-300">Thinking...</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Premium Input Area */}
            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border-t border-slate-200/50 dark:border-slate-700/50 p-4">
                {error && (
                    <div className="mb-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 px-4 py-3">
                        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                    </div>
                )}

                <form
                    className="flex gap-3"
                    onSubmit={(e) => {
                        e.preventDefault();
                        void handleSend();
                    }}
                >
                    <div className="relative flex-1">
                        <input
                            type="text"
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            placeholder="Ask anything about your studies..."
                            className={cn(
                                'w-full rounded-2xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-5 py-4 pr-16 text-sm outline-none transition-all shadow-sm',
                                'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-lg focus:shadow-xl',
                                'placeholder:text-slate-500 dark:placeholder:text-slate-400',
                            )}
                            disabled={sending || loadingThread}
                        />
                        <div className="absolute bottom-4 right-4 text-[10px] text-slate-400">
                            {draft.trim().length}/5000
                        </div>
                    </div>
                    <Button
                        type="submit"
                        size="icon"
                        className="h-12 w-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg shadow-blue-500/25 border-0 transition-all"
                        disabled={sending || loadingThread || !draft.trim()}
                    >
                        <Send className="h-5 w-5 text-white" />
                    </Button>
                </form>
            </div>
        </div>
    );
}
