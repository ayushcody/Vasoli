import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: {
    type?: 'insight' | 'suggestion' | 'analysis' | 'general';
    relatedEntity?: {
      type: string;
      id: string;
    };
    actions?: Array<{
      label: string;
      action: string;
      data?: unknown;
    }>;
  };
}

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  context?: {
    currentView?: string;
    selectedDateRange?: { start: Date; end: Date };
    selectedCategories?: string[];
  };
}

interface ChatState {
  // Sessions
  sessions: ChatSession[];
  currentSessionId: string | null;
  
  // Actions
  createSession: (title?: string) => string;
  switchSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
  clearAllSessions: () => void;
  
  // Messages
  addMessage: (sessionId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  updateMessage: (sessionId: string, messageId: string, updates: Partial<ChatMessage>) => void;
  deleteMessage: (sessionId: string, messageId: string) => void;
  clearSessionMessages: (sessionId: string) => void;
  
  // Context
  updateSessionContext: (sessionId: string, context: ChatSession['context']) => void;
  
  // UI State
  isTyping: boolean;
  setIsTyping: (typing: boolean) => void;
  isOpen: boolean;
  toggleOpen: () => void;
  setOpen: (open: boolean) => void;
  
  // Suggestions
  suggestions: string[];
  setSuggestions: (suggestions: string[]) => void;
  refreshSuggestions: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      sessions: [],
      currentSessionId: null,
      isTyping: false,
      isOpen: false,
      suggestions: [],

      createSession: (title) => {
        const id = Math.random().toString(36).substring(7);
        const newSession: ChatSession = {
          id,
          title: title || `Chat ${get().sessions.length + 1}`,
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        set(state => ({
          sessions: [...state.sessions, newSession],
          currentSessionId: id,
        }));
        return id;
      },

      switchSession: (sessionId) => {
        set({ currentSessionId: sessionId });
      },

      deleteSession: (sessionId) => {
        set(state => {
          const newSessions = state.sessions.filter(s => s.id !== sessionId);
          return {
            sessions: newSessions,
            currentSessionId: state.currentSessionId === sessionId
              ? newSessions[0]?.id || null
              : state.currentSessionId,
          };
        });
      },

      clearAllSessions: () => {
        set({ sessions: [], currentSessionId: null });
      },

      addMessage: (sessionId, message) => {
        const newMessage: ChatMessage = {
          ...message,
          id: Math.random().toString(36).substring(7),
          timestamp: new Date(),
        };
        set(state => ({
          sessions: state.sessions.map(session =>
            session.id === sessionId
              ? {
                  ...session,
                  messages: [...session.messages, newMessage],
                  updatedAt: new Date(),
                }
              : session
          ),
        }));
      },

      updateMessage: (sessionId, messageId, updates) => {
        set(state => ({
          sessions: state.sessions.map(session =>
            session.id === sessionId
              ? {
                  ...session,
                  messages: session.messages.map(msg =>
                    msg.id === messageId ? { ...msg, ...updates } : msg
                  ),
                  updatedAt: new Date(),
                }
              : session
          ),
        }));
      },

      deleteMessage: (sessionId, messageId) => {
        set(state => ({
          sessions: state.sessions.map(session =>
            session.id === sessionId
              ? {
                  ...session,
                  messages: session.messages.filter(msg => msg.id !== messageId),
                  updatedAt: new Date(),
                }
              : session
          ),
        }));
      },

      clearSessionMessages: (sessionId) => {
        set(state => ({
          sessions: state.sessions.map(session =>
            session.id === sessionId
              ? { ...session, messages: [], updatedAt: new Date() }
              : session
          ),
        }));
      },

      updateSessionContext: (sessionId, context) => {
        set(state => ({
          sessions: state.sessions.map(session =>
            session.id === sessionId
              ? { ...session, context: { ...session.context, ...context } }
              : session
          ),
        }));
      },

      setIsTyping: (typing) => set({ isTyping: typing }),
      toggleOpen: () => set(state => ({ isOpen: !state.isOpen })),
      setOpen: (open) => set({ isOpen: open }),
      setSuggestions: (suggestions) => set({ suggestions }),
      refreshSuggestions: () => {
        const suggestions = [
          "What's my spending trend this month?",
          "How am I doing with my budgets?",
          "Suggest ways to save more",
          "Analyze my top spending categories",
          "When will I reach my savings goal?",
        ];
        set({ suggestions });
      },
    }),
    {
      name: 'vasoli-chat-storage',
      partialize: (state) => ({
        sessions: state.sessions,
        currentSessionId: state.currentSessionId,
      }),
    }
  )
);
