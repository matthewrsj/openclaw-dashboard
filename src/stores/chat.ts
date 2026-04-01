/**
 * Chat state store.
 *
 * Manages chat messages, drafts, streaming state, and scroll positions
 * for all agent conversations.
 */

import { create } from "zustand";
import type { ChatMessage, StreamingState } from "../types/chat";

interface ChatStore {
  /** Map of session key → messages. */
  messages: Map<string, ChatMessage[]>;
  /** Map of agent ID → draft text. */
  drafts: Map<string, string>;
  /** Map of agent ID → scroll offset. */
  scrollPositions: Map<string, number>;
  /** Map of session key → streaming state. */
  streamingState: Map<string, StreamingState>;
  /** Currently active agent ID for chat. */
  activeAgentId: string | null;

  // Actions
  /** Add a message to a session. */
  addMessage: (sessionKey: string, message: ChatMessage) => void;
  /** Update a specific message by ID. */
  updateMessage: (
    sessionKey: string,
    messageId: string,
    patch: Partial<ChatMessage>,
  ) => void;
  /** Set the draft text for an agent. */
  setDraft: (agentId: string, text: string) => void;
  /** Set the scroll position for an agent. */
  setScrollPosition: (agentId: string, position: number) => void;
  /** Update streaming state for a session. */
  setStreamingState: (
    sessionKey: string,
    state: Partial<StreamingState>,
  ) => void;
  /** Set the active agent for chat. */
  setActiveAgentId: (agentId: string | null) => void;
  /** Clear messages for a session. */
  clearMessages: (sessionKey: string) => void;

  // Selectors
  getMessages: (sessionKey: string) => ChatMessage[];
  getDraft: (agentId: string) => string;
  isStreaming: (sessionKey: string) => boolean;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: new Map(),
  drafts: new Map(),
  scrollPositions: new Map(),
  streamingState: new Map(),
  activeAgentId: null,

  addMessage: (sessionKey: string, message: ChatMessage) => {
    const messages = new Map(get().messages);
    const sessionMessages = [...(messages.get(sessionKey) || [])];
    sessionMessages.push(message);
    messages.set(sessionKey, sessionMessages);
    set({ messages });
  },

  updateMessage: (
    sessionKey: string,
    messageId: string,
    patch: Partial<ChatMessage>,
  ) => {
    const messages = new Map(get().messages);
    const sessionMessages = [...(messages.get(sessionKey) || [])];
    const idx = sessionMessages.findIndex((m) => m.id === messageId);
    if (idx >= 0) {
      sessionMessages[idx] = { ...sessionMessages[idx], ...patch };
      messages.set(sessionKey, sessionMessages);
      set({ messages });
    }
  },

  setDraft: (agentId: string, text: string) => {
    const drafts = new Map(get().drafts);
    drafts.set(agentId, text);
    set({ drafts });
  },

  setScrollPosition: (agentId: string, position: number) => {
    const scrollPositions = new Map(get().scrollPositions);
    scrollPositions.set(agentId, position);
    set({ scrollPositions });
  },

  setStreamingState: (
    sessionKey: string,
    state: Partial<StreamingState>,
  ) => {
    const streamingState = new Map(get().streamingState);
    const existing = streamingState.get(sessionKey) || {
      isStreaming: false,
      abortController: null,
      partialContent: "",
    };
    streamingState.set(sessionKey, { ...existing, ...state });
    set({ streamingState });
  },

  setActiveAgentId: (agentId: string | null) =>
    set({ activeAgentId: agentId }),

  clearMessages: (sessionKey: string) => {
    const messages = new Map(get().messages);
    messages.delete(sessionKey);
    set({ messages });
  },

  getMessages: (sessionKey: string) =>
    get().messages.get(sessionKey) || [],

  getDraft: (agentId: string) => get().drafts.get(agentId) || "",

  isStreaming: (sessionKey: string) =>
    get().streamingState.get(sessionKey)?.isStreaming || false,
}));
