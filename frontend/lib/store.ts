import { create } from 'zustand';
import type { ChatMessage, Session } from '@/types';
import type { WsStatus } from '@/lib/api';

interface ChatStore {
  // Current session
  sessionId: string;
  messages: ChatMessage[];
  isLoading: boolean;
  streamingContent: string;

  // WebSocket state
  wsStatus: WsStatus;
  isThinking: boolean;

  // Session list
  sessions: Session[];

  // Actions
  setSessionId: (id: string) => void;
  setMessages: (msgs: ChatMessage[]) => void;
  addMessage: (msg: ChatMessage) => void;
  setIsLoading: (loading: boolean) => void;
  setStreamingContent: (content: string) => void;
  appendStreamingContent: (chunk: string) => void;
  setSessions: (sessions: Session[]) => void;
  clearMessages: () => void;
  setWsStatus: (status: WsStatus) => void;
  setIsThinking: (thinking: boolean) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  sessionId: 'web:default',
  messages: [],
  isLoading: false,
  streamingContent: '',
  wsStatus: 'disconnected',
  isThinking: false,
  sessions: [],

  setSessionId: (id) => set({ sessionId: id }),
  setMessages: (msgs) => set({ messages: msgs }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setStreamingContent: (content) => set({ streamingContent: content }),
  appendStreamingContent: (chunk) =>
    set((s) => ({ streamingContent: s.streamingContent + chunk })),
  setSessions: (sessions) => set({ sessions }),
  clearMessages: () => set({ messages: [], streamingContent: '' }),
  setWsStatus: (status) => set({ wsStatus: status }),
  setIsThinking: (thinking) => set({ isThinking: thinking }),
}));
