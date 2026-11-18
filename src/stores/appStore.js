import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const defaultSettings = {
  theme: 'system',
  model: '',
  temperature: 0.7,
  maxOutputTokens: 2048,
  systemPrompt: 'You are a helpful, accurate assistant. If you are unsure, say so.',
  webSearch: false,
};

export const useSettingsStore = create(
  persist(
    (set) => ({
      settings: defaultSettings,
      updateSettings: (patch) =>
        set((state) => ({ settings: { ...state.settings, ...patch } })),
      resetSettings: () => set({ settings: defaultSettings }),
    }),
    {
      name: 'carbon-chat-settings',
      partialize: (state) => ({ settings: state.settings }),
    },
  ),
);

export const useAppStore = create((set) => ({
  conversations: [],
  activeId: null,
  query: '',
  sidebarOpen: true,
  config: { configured: false, searchAvailable: false },
  setConversations: (conversations) => set({ conversations }),
  setActiveId: (activeId) => set({ activeId }),
  setQuery: (query) => set({ query }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setConfig: (config) => set({ config }),
  upsertConversation: (conversation) =>
    set((state) => ({
      conversations: [
        conversation,
        ...state.conversations.filter((item) => item.id !== conversation.id),
      ].sort((a, b) => b.updatedAt - a.updatedAt),
    })),
  forgetConversation: (id) =>
    set((state) => ({
      conversations: state.conversations.filter((item) => item.id !== id),
      activeId: state.activeId === id ? null : state.activeId,
    })),
}));
