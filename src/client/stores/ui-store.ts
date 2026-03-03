import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIStore {
  // Sidebar state
  sidebarOpen: boolean;
  mobileMenuOpen: boolean;
  toggleSidebar: () => void;
  toggleMobileMenu: () => void;
  closeMobileMenu: () => void;

  // Modal state
  activeModal: {
    type: string | null;
    data: unknown;
  };
  openModal: (type: string, data?: unknown) => void;
  closeModal: () => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      // Sidebar
      sidebarOpen: true,
      mobileMenuOpen: false,
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      toggleMobileMenu: () => set((state) => ({ mobileMenuOpen: !state.mobileMenuOpen })),
      closeMobileMenu: () => set({ mobileMenuOpen: false }),

      // Modal
      activeModal: { type: null, data: null },
      openModal: (type, data = null) => set({ activeModal: { type, data } }),
      closeModal: () => set({ activeModal: { type: null, data: null } }),
    }),
    {
      name: 'vasoli-ui',
      partialize: (state) => ({ sidebarOpen: state.sidebarOpen }),
    }
  )
);
