"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Bot,
    Plus,
    Send,
    Loader2,
    MessageSquare,
    Sparkles,
    TrendingUp,
    Receipt,
    CalendarClock,
    Database,
    Trash2,
    ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useMarcoStore } from "@/lib/stores/marco-store";

// ─── Types ────────────────────────────────────────────────────
interface Thread {
    id: string;
    title: string;
    lastMessageAt: string;
    createdAt: string;
    _count: { messages: number };
}

interface Message {
    id: string;
    role: string;
    content: string;
    createdAt: string;
}

// ─── Suggested Prompts ────────────────────────────────────────
const SUGGESTIONS = [
    {
        icon: TrendingUp,
        label: "Can I spend?",
        prompt: "Can I spend ₹2,000 this weekend?",
        color: "bg-teal/15 text-teal",
    },
    {
        icon: Sparkles,
        label: "Recent changes",
        prompt: "What changed this month?",
        color: "bg-cta/15 text-cta",
    },
    {
        icon: Receipt,
        label: "Money leaks",
        prompt: "Find my money leaks",
        color: "bg-grape/15 text-grape",
    },
    {
        icon: CalendarClock,
        label: "Upcoming bills",
        prompt: "What bill is coming next?",
        color: "bg-cobalt/15 text-cobalt",
    },
];

const TOOL_LABELS: Record<string, string> = {
    get_dashboard_snapshot: "Checking your dashboard…",
    search_transactions: "Searching transactions…",
    get_cashflow_radar: "Analyzing cashflow…",
    get_recurring: "Checking recurring bills…",
    get_goals: "Looking at your goals…",
    get_receipts_lifecycle: "Checking receipts…",
    get_sync_confidence: "Checking data freshness…",
    get_spending_analytics: "Analyzing spending…",
    get_upcoming_reminders: "Checking reminders…",
    get_health_score: "Calculating health score…",
};

// ─── Main Page ────────────────────────────────────────────────
export default function MarcoPage() {
    const [threads, setThreads] = useState<Thread[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loadingThreads, setLoadingThreads] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);

    const {
        activeThreadId,
        isStreaming,
        composerDraft,
        streamingContent,
        toolsUsed,
        setActiveThread,
        setStreaming,
        setComposerDraft,
        appendStreamContent,
        resetStream,
        addToolUsed,
    } = useMarcoStore();

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const composerRef = useRef<HTMLTextAreaElement>(null);

    // ─── Fetch threads ──────────────────────────────────────────
    const fetchThreads = useCallback(async () => {
        try {
            const res = await fetch("/api/marco/threads");
            if (res.ok) {
                const data = await res.json();
                setThreads(data);
            } else {
                toast.error("Failed to load Marco conversations");
            }
        } catch {
            toast.error("Failed to load Marco conversations");
        } finally {
            setLoadingThreads(false);
        }
    }, []);

    useEffect(() => {
        fetchThreads();
    }, [fetchThreads]);

    // ─── Fetch messages for active thread ───────────────────────
    useEffect(() => {
        if (!activeThreadId) {
            setMessages([]);
            return;
        }

        setLoadingMessages(true);
        fetch(`/api/marco/threads/${activeThreadId}`)
            .then((res) => res.json())
            .then((data) => {
                setMessages(data.messages || []);
                setLoadingMessages(false);
            })
            .catch(() => {
                toast.error("Failed to load Marco messages");
                setLoadingMessages(false);
            });
    }, [activeThreadId]);

    // ─── Auto-scroll ────────────────────────────────────────────
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, streamingContent]);

    // ─── Create new thread ──────────────────────────────────────
    const createThread = async () => {
        try {
            const res = await fetch("/api/marco/threads", { method: "POST" });
            if (res.ok) {
                const thread = await res.json();
                setActiveThread(thread.id);
                await fetchThreads();
            } else {
                toast.error("Failed to create a new conversation");
            }
        } catch {
            toast.error("Failed to create a new conversation");
        }
    };

    // ─── Delete thread ──────────────────────────────────────────
    const deleteThread = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await fetch(`/api/marco/threads/${id}`, { method: "DELETE" });
            if (activeThreadId === id) {
                setActiveThread(null);
                setMessages([]);
            }
            await fetchThreads();
        } catch {
            toast.error("Failed to delete that conversation");
        }
    };

    // ─── Send message ──────────────────────────────────────────
    const sendMessage = async (text?: string) => {
        const content = text || composerDraft.trim();
        if (!content || isStreaming) return;

        let threadId = activeThreadId;

        // Auto-create thread if none active
        if (!threadId) {
            try {
                const res = await fetch("/api/marco/threads", { method: "POST" });
                if (res.ok) {
                    const thread = await res.json();
                    threadId = thread.id;
                    setActiveThread(thread.id);
                } else {
                    toast.error("Failed to create a new conversation");
                }
            } catch {
                toast.error("Failed to create a new conversation");
                return;
            }
        }

        // Optimistic UI update
        const optimisticMsg: Message = {
            id: `temp-${Date.now()}`,
            role: "user",
            content,
            createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, optimisticMsg]);
        setComposerDraft("");
        resetStream();
        setStreaming(true);

        try {
            const res = await fetch("/api/marco/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ threadId, message: content }),
            });

            if (!res.ok) {
                throw new Error("Chat request failed");
            }

            // Read SSE stream
            const reader = res.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) throw new Error("No response body");

            let buffer = "";
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (data.type === "text") {
                                appendStreamContent(data.content);
                            } else if (data.type === "tool_use") {
                                addToolUsed(data.tool);
                            } else if (data.type === "done") {
                                // Done
                            } else if (data.type === "error") {
                                appendStreamContent(data.content);
                            }
                        } catch {
                            /* ignore parse errors */
                        }
                    }
                }
            }

            // Finalize: add assistant message
            const finalContent = useMarcoStore.getState().streamingContent;
            if (finalContent) {
                setMessages((prev) => [
                    ...prev,
                    {
                        id: `assistant-${Date.now()}`,
                        role: "assistant",
                        content: finalContent,
                        createdAt: new Date().toISOString(),
                    },
                ]);
            }

            // Refresh threads to get updated title
            await fetchThreads();
        } catch (err) {
            toast.error("Marco could not send that message");
            setMessages((prev) => [
                ...prev,
                {
                    id: `error-${Date.now()}`,
                    role: "assistant",
                    content: "Sorry, I couldn't process that. Please try again.",
                    createdAt: new Date().toISOString(),
                },
            ]);
        } finally {
            setStreaming(false);
            resetStream();
        }
    };

    // ─── Handle keyboard ───────────────────────────────────────
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    if (process.env.NEXT_PUBLIC_MARCO_ENABLED !== "true") {
        return <section className="neo-surface p-6"><h1 className="text-3xl font-bold">Marco is optional</h1><p className="mt-3 max-w-xl text-sm leading-6 text-taupe">AI chat is disabled for this pilot configuration. Your records, imports, bills and payday plan work independently.</p><a className="mt-5 inline-block font-semibold underline" href="/app/dashboard">Review your payday plan</a></section>;
    }

    // ─── Render ─────────────────────────────────────────────────
    return (
        <div className="flex h-full">
            {/* ─── Left Sidebar: Thread List ──────────────────── */}
            <div className="w-72 flex-shrink-0 border-r-brutal bg-paper-2/50 flex flex-col">
                <div className="p-4 border-b-brutal">
                    <button
                        onClick={createThread}
                        className="w-full flex items-center justify-center gap-2 border-brutal rounded-neo px-4 py-3 text-sm font-bold bg-cta text-ink shadow-brutal-sm hover:shadow-brutal hover:translate-y-[-2px] transition-all"
                    >
                        <Plus size={16} />
                        New Chat
                    </button>
                </div>

                <div className="flex-1 overflow-auto p-2 space-y-1">
                    {loadingThreads ? (
                        <div className="flex items-center justify-center py-8 text-taupe">
                            <Loader2 className="animate-spin" size={20} />
                        </div>
                    ) : threads.length === 0 ? (
                        <div className="text-center py-8 text-taupe text-sm">
                            <MessageSquare className="mx-auto mb-2 opacity-40" size={24} />
                            No conversations yet
                        </div>
                    ) : (
                        threads.map((thread) => (
                            <button
                                key={thread.id}
                                onClick={() => setActiveThread(thread.id)}
                                className={`w-full text-left group flex items-center gap-2 rounded-neo px-3 py-2.5 text-sm transition-all ${activeThreadId === thread.id
                                        ? "bg-paper-2 border-brutal shadow-brutal-sm text-ink font-medium"
                                        : "text-taupe hover:bg-paper-2/80 hover:text-ink"
                                    }`}
                            >
                                <MessageSquare size={14} className="flex-shrink-0 opacity-50" />
                                <span className="flex-1 truncate">{thread.title}</span>
                                <button
                                    onClick={(e) => deleteThread(thread.id, e)}
                                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-danger transition-all"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </button>
                        ))
                    )}
                </div>

                {/* Privacy note */}
                <div className="p-3 border-t-brutal bg-paper-2/30">
                    <div className="flex items-start gap-2 text-xs text-taupe">
                        <ShieldCheck size={14} className="mt-0.5 flex-shrink-0 text-teal" />
                        <span>Marco only uses your Vasoli data. Receipts remain encrypted.</span>
                    </div>
                </div>
            </div>

            {/* ─── Main Chat Area ─────────────────────────────── */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Chat Header */}
                <div className="flex items-center gap-3 px-6 py-4 border-b-brutal bg-paper-1">
                    <div className="p-2 rounded-neo bg-grape/15">
                        <Bot size={20} className="text-grape" />
                    </div>
                    <div>
                        <h1 className="font-serif text-xl font-bold text-ink">Marco</h1>
                        <p className="text-xs text-taupe">Your money coach • Not financial advice</p>
                    </div>
                </div>

                {/* Messages or Empty State */}
                <div className="flex-1 overflow-auto px-6 py-4">
                    {!activeThreadId && messages.length === 0 ? (
                        // ─── Empty State ───────────────────────────────
                        <div className="flex flex-col items-center justify-center h-full max-w-lg mx-auto">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-center mb-8"
                            >
                                <div className="w-16 h-16 rounded-neo-md border-brutal-thick bg-grape/15 flex items-center justify-center mx-auto mb-4 shadow-brutal">
                                    <Bot size={32} className="text-grape" />
                                </div>
                                <h2 className="font-serif text-2xl font-bold text-ink mb-2">
                                    Hey! I&apos;m Marco 👋
                                </h2>
                                <p className="text-taupe text-sm max-w-sm">
                                    Your personal money coach. I can help you understand your spending, plan your cashflow, and stay on top of bills — all grounded in your actual data.
                                </p>
                            </motion.div>

                            <div className="grid grid-cols-2 gap-3 w-full">
                                {SUGGESTIONS.map((s, i) => (
                                    <motion.button
                                        key={s.label}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.1 + i * 0.08 }}
                                        onClick={() => sendMessage(s.prompt)}
                                        className="text-left border-brutal rounded-neo p-4 bg-paper-2 hover:shadow-brutal hover:translate-y-[-2px] transition-all group"
                                    >
                                        <div className={`p-1.5 rounded-neo inline-flex mb-2 ${s.color}`}>
                                            <s.icon size={14} />
                                        </div>
                                        <p className="text-sm font-medium text-ink">{s.label}</p>
                                        <p className="text-xs text-taupe mt-1 group-hover:text-ink transition-colors">
                                            {s.prompt}
                                        </p>
                                    </motion.button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        // ─── Messages ──────────────────────────────────
                        <div className="space-y-4 max-w-2xl mx-auto">
                            <AnimatePresence>
                                {messages.map((msg) => (
                                    <motion.div
                                        key={msg.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                                    >
                                        <div
                                            className={`max-w-[80%] rounded-neo-md p-4 ${msg.role === "user"
                                                    ? "bg-paper-2 border-brutal shadow-brutal-sm"
                                                    : "bg-paper-1 border-brutal"
                                                }`}
                                        >
                                            {msg.role === "assistant" && (
                                                <div className="flex items-center gap-1.5 mb-2">
                                                    <span className="text-[10px] font-black uppercase tracking-wider bg-grape/15 text-grape px-1.5 py-0.5 rounded">
                                                        Marco
                                                    </span>
                                                </div>
                                            )}
                                            <div className="text-sm text-ink whitespace-pre-wrap leading-relaxed marco-content">
                                                {msg.content}
                                            </div>
                                            <div className="text-[10px] text-taupe mt-2">
                                                {new Date(msg.createdAt).toLocaleTimeString("en-IN", {
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>

                            {/* Streaming indicator */}
                            {isStreaming && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex justify-start"
                                >
                                    <div className="max-w-[80%] rounded-neo-md p-4 bg-paper-1 border-brutal">
                                        <div className="flex items-center gap-1.5 mb-2">
                                            <span className="text-[10px] font-black uppercase tracking-wider bg-grape/15 text-grape px-1.5 py-0.5 rounded">
                                                Marco
                                            </span>
                                        </div>

                                        {/* Tool usage indicators */}
                                        {toolsUsed.length > 0 && (
                                            <div className="mb-2 space-y-1">
                                                {toolsUsed.map((tool) => (
                                                    <div
                                                        key={tool}
                                                        className="flex items-center gap-1.5 text-xs text-taupe"
                                                    >
                                                        <Database size={10} className="text-teal" />
                                                        <span>{TOOL_LABELS[tool] || tool}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {streamingContent ? (
                                            <div className="text-sm text-ink whitespace-pre-wrap leading-relaxed">
                                                {streamingContent}
                                                <span className="inline-block w-1.5 h-4 bg-grape/50 ml-0.5 animate-pulse" />
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-taupe text-sm">
                                                <Loader2 size={14} className="animate-spin" />
                                                {toolsUsed.length > 0
                                                    ? "Processing your data…"
                                                    : "Thinking…"}
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </div>

                {/* ─── Composer ───────────────────────────────────── */}
                <div className="border-t-brutal bg-paper-2/30 p-4">
                    <div className="max-w-2xl mx-auto flex gap-3">
                        <textarea
                            ref={composerRef}
                            value={composerDraft}
                            onChange={(e) => setComposerDraft(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask Marco about your finances…"
                            rows={1}
                            disabled={isStreaming}
                            className="flex-1 bg-paper-1 border-brutal rounded-neo px-4 py-3 text-sm text-ink placeholder:text-taupe resize-none focus:outline-none focus:shadow-brutal-sm transition-shadow disabled:opacity-50"
                            style={{ minHeight: "44px", maxHeight: "120px" }}
                            onInput={(e) => {
                                const target = e.target as HTMLTextAreaElement;
                                target.style.height = "auto";
                                target.style.height = Math.min(target.scrollHeight, 120) + "px";
                            }}
                        />
                        <button
                            onClick={() => sendMessage()}
                            disabled={!composerDraft.trim() || isStreaming}
                            className="flex-shrink-0 border-brutal rounded-neo p-3 bg-cta text-ink shadow-brutal-sm hover:shadow-brutal hover:translate-y-[-2px] transition-all disabled:opacity-40 disabled:hover:shadow-brutal-sm disabled:hover:translate-y-0"
                        >
                            {isStreaming ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <Send size={18} />
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
