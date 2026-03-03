import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: 'default' | 'success' | 'error' | 'warning';
  duration?: number;
}

interface ModalState {
  isOpen: boolean;
  type: string | null;
  data: unknown;
}

interface UIState {
  // Sidebar
  sidebarOpen: boolean;
  mobileMenuOpen: boolean;
  toggleSidebar: () => void;
  toggleMobileMenu: () => void;
  closeMobileMenu: () => void;

  // Modals
  activeModal: ModalState;
  openModal: (type: string, data?: unknown) => void;
  closeModal: () => void;

  // Toasts
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;

  // Page transitions
  pageTransitionDirection: 'forward' | 'backward';
  setPageTransitionDirection: (direction: 'forward' | 'backward') => void;

  // Form drafts
  formDrafts: Record<string, unknown>;
  setFormDraft: (key: string, data: unknown) => void;
  clearFormDraft: (key: string) => void;

  // Filter preferences
  filterPreferences: Record<string, unknown>;
  setFilterPreference: (key: string, value: unknown) => void;
  resetFilterPreferences: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      // Sidebar
      sidebarOpen: true,
      mobileMenuOpen: false,
      toggleSidebar: () => set(state => ({ sidebarOpen: !state.sidebarOpen })),
      toggleMobileMenu: () => set(state => ({ mobileMenuOpen: !state.mobileMenuOpen })),
      closeMobileMenu: () => set({ mobileMenuOpen: false }),

      // Modals
      activeModal: { isOpen: false, type: null, data: null },
      openModal: (type, data = null) => set({
        activeModal: { isOpen: true, type, data }
      }),
      closeModal: () => set({
        activeModal: { isOpen: false, type: null, data: null }
      }),

      // Toasts
      toasts: [],
      addToast: (toast) => {
        const id = Math.random().toString(36).substring(7);
        set(state => ({
          toasts: [...state.toasts, { ...toast, id }]
        }));
        setTimeout(() => {
          get().removeToast(id);
        }, toast.duration || 5000);
      },
      removeToast: (id) => set(state => ({
        toasts: state.toasts.filter(t => t.id !== id)
      })),

      // Page transitions
      pageTransitionDirection: 'forward',
      setPageTransitionDirection: (direction) => set({ pageTransitionDirection: direction }),

      // Form drafts
      formDrafts: {},
      setFormDraft: (key, data) => set(state => ({
        formDrafts: { ...state.formDrafts, [key]: data }
      })),
      clearFormDraft: (key) => set(state => {
        const { [key]: _, ...rest } = state.formDrafts;
        return { formDrafts: rest };
      }),

      // Filter preferences
      filterPreferences: {},
      setFilterPreference: (key, value) => set(state => ({
        filterPreferences: { ...state.filterPreferences, [key]: value }
      })),
      resetFilterPreferences: () => set({ filterPreferences: {} }),
    }),
    {
      name: 'vasoli-ui-storage',
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        filterPreferences: state.filterPreferences,
      }),
    }
  )
);
