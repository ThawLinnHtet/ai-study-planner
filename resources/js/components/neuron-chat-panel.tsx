import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Send } from 'lucide-react';
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
    initialThreadId: string;
    initialThreads?: NeuronChatThread[];
    initialMessages?: NeuronChatMessage[];
    className?: string;
    variant?: 'page' | 'widget';
};

const SUGGESTIONS: string[] = [
    'What should I study today based on my plan?',
    'Summarize my recent progress and what to fix next.',
    'Turn today’s sessions into a 3-step action plan.',
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

export default function NeuronChatPanel({
    initialThreadId,
    initialThreads = [],
    initialMessages = [],
    className,
    variant = 'widget',
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
        if (!scrollRef.current) return;
        scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages.length, sending, loadingThread]);

    const refreshThreads = async () => {
        try {
            const data = await getJson<{ threads: NeuronChatThread[] }>('/ai-tutor/threads');
            setThreads(data.threads || []);
        } catch {
            // ignore
        }
    };

    const openThread = async (nextThreadId: string) => {
        setError(null);
        setLoadingThread(true);
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
        <Card className={cn('flex h-full flex-col overflow-hidden border-border/60', className)}>
            <div className="relative overflow-hidden border-b border-border/60">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-fuchsia-500/10 to-cyan-500/20" />
                <div className="relative p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.15)]" />
                                <h2 className="text-sm font-semibold tracking-wide">Neuron Chat</h2>
                                <Badge variant="secondary" className="text-[10px]">
                                    context-aware
                                </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{headerSubtitle}</p>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                className="h-8"
                                onClick={newThread}
                                disabled={loadingThread || sending}
                            >
                                New
                            </Button>
                        </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                        {threads.slice(0, 6).map((t) => (
                            <button
                                key={t.thread_id}
                                type="button"
                                onClick={() => openThread(t.thread_id)}
                                className={cn(
                                    'group rounded-full border px-3 py-1 text-left text-xs transition-colors',
                                    t.thread_id === threadId
                                        ? 'border-primary/50 bg-primary/10 text-primary'
                                        : 'border-border/70 bg-background/60 hover:bg-muted',
                                )}
                            >
                                <span className="max-w-[240px] truncate block">
                                    {t.preview || 'New conversation'}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex flex-1 min-h-0 flex-col">
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
                    {loadingThread ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Spinner />
                            Loading thread…
                        </div>
                    ) : null}

                    {!hasAnyMessages && !loadingThread ? (
                        <div className="space-y-4">
                            <div className="rounded-xl border border-border/60 bg-gradient-to-br from-primary/10 via-background to-background p-4">
                                <p className="text-sm font-semibold">Try a quick prompt</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Neuron will use your plan, XP, streak, and recent sessions.
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {SUGGESTIONS.map((s) => (
                                        <Button
                                            key={s}
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="h-8 rounded-full"
                                            onClick={() => {
                                                setDraft(s);
                                                setTimeout(() => handleSend(), 0);
                                            }}
                                            disabled={sending}
                                        >
                                            {s}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            <Separator />

                            <div className="text-xs text-muted-foreground">
                                Tip: Ask “What’s my next best move?” for an action plan.
                            </div>
                        </div>
                    ) : null}

                    <div className="space-y-3">
                        {messages
                            .filter((m) => m.role !== 'system')
                            .map((m, idx) => (
                                <motion.div
                                    key={`${m.role}-${idx}-${m.content.slice(0, 16)}`}
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className={cn(
                                        'flex',
                                        m.role === 'user' ? 'justify-end' : 'justify-start',
                                    )}
                                >
                                    <div
                                        className={cn(
                                            'max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm',
                                            m.role === 'user'
                                                ? 'bg-primary text-primary-foreground'
                                                : 'bg-gradient-to-br from-background to-muted border border-border/60',
                                        )}
                                    >
                                        <div className="whitespace-pre-wrap break-words">{m.content}</div>
                                    </div>
                                </motion.div>
                            ))}

                        {sending ? (
                            <div className="flex justify-start">
                                <div className="max-w-[85%] rounded-2xl border border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                                    <span className="inline-flex items-center gap-2">
                                        <Spinner className="size-3" />
                                        Neuron is thinking…
                                    </span>
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>

                <div className="border-t border-border/60 p-3">
                    {error ? (
                        <div className="mb-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                            {error}
                        </div>
                    ) : null}

                    <form
                        className="flex items-end gap-2"
                        onSubmit={(e) => {
                            e.preventDefault();
                            void handleSend();
                        }}
                    >
                        <div className="relative flex-1">
                            <textarea
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                placeholder="Ask Neuron…"
                                rows={variant === 'page' ? 3 : 2}
                                className={cn(
                                    'min-h-[44px] w-full resize-none rounded-xl border border-border/60 bg-background px-3 py-2 text-sm shadow-xs outline-none',
                                    'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
                                )}
                                disabled={sending || loadingThread}
                            />
                            <div className="pointer-events-none absolute bottom-2 right-2 text-[10px] text-muted-foreground">
                                {draft.trim().length}/5000
                            </div>
                        </div>
                        <Button
                            type="submit"
                            size="icon"
                            className="h-11 w-11 rounded-xl"
                            disabled={sending || loadingThread || !draft.trim()}
                        >
                            <Send className="h-4 w-4" />
                        </Button>
                    </form>
                </div>
            </div>
        </Card>
    );
}
