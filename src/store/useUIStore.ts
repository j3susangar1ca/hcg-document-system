import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  sidebarCollapsed: boolean;
  selectedDocumentId: string | null;
  searchQuery: string;
  darkMode: boolean;
  
  toggleSidebar: () => void;
  selectDocument: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  toggleDarkMode: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      selectedDocumentId: null,
      searchQuery: '',
      darkMode: false,

      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      
      selectDocument: (id) => set({ selectedDocumentId: id }),
      
      setSearchQuery: (query) => set({ searchQuery: query }),
      
      toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
    }),
    {
      name: 'ui-storage',
    }
  )
);
