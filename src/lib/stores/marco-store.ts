import { create } from "zustand";

interface MarcoState {
    activeThreadId: string | null;
    isStreaming: boolean;
    composerDraft: string;
    streamingContent: string;
    toolsUsed: string[];

    setActiveThread: (id: string | null) => void;
    setStreaming: (streaming: boolean) => void;
    setComposerDraft: (draft: string) => void;
    appendStreamContent: (chunk: string) => void;
    resetStream: () => void;
    addToolUsed: (tool: string) => void;
}

export const useMarcoStore = create<MarcoState>((set) => ({
    activeThreadId: null,
    isStreaming: false,
    composerDraft: "",
    streamingContent: "",
    toolsUsed: [],

    setActiveThread: (id) => set({ activeThreadId: id }),
    setStreaming: (streaming) => set({ isStreaming: streaming }),
    setComposerDraft: (draft) => set({ composerDraft: draft }),
    appendStreamContent: (chunk) =>
        set((state) => ({ streamingContent: state.streamingContent + chunk })),
    resetStream: () => set({ streamingContent: "", toolsUsed: [] }),
    addToolUsed: (tool) =>
        set((state) => ({
            toolsUsed: state.toolsUsed.includes(tool)
                ? state.toolsUsed
                : [...state.toolsUsed, tool],
        })),
}));
