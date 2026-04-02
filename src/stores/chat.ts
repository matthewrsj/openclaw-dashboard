/**
 * Chat state store.
 *
 * Manages chat messages, drafts, streaming state, and scroll positions
 * for all agent conversations.
 */

import { create } from "zustand";
import type { ChatMessage, StreamingState } from "../types/chat";
import { uniqueId } from "../lib/utils";

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
  /** Map of session key → pending assistant message ID (awaiting streamed response). */
  pendingAssistantIds: Map<string, string>;

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
  /** Track the pending assistant message ID for streaming updates. */
  setPendingAssistantId: (sessionKey: string, messageId: string | null) => void;
  /** Handle a chat stream event from the Gateway. */
  handleChatEvent: (data: Record<string, unknown>) => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: new Map(),
  drafts: new Map(),
  scrollPositions: new Map(),
  streamingState: new Map(),
  activeAgentId: null,
  pendingAssistantIds: new Map(),

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

  setPendingAssistantId: (sessionKey: string, messageId: string | null) => {
    const pendingAssistantIds = new Map(get().pendingAssistantIds);
    if (messageId) {
      pendingAssistantIds.set(sessionKey, messageId);
    } else {
      pendingAssistantIds.delete(sessionKey);
    }
    set({ pendingAssistantIds });
  },

  handleChatEvent: (data: Record<string, unknown>) => {
    const sessionKey = (data.sessionKey as string) || (data.key as string) || "";
    if (!sessionKey) return;

    const eventKind = (data.kind as string) || (data.type as string) || "";
    const content = (data.content as string) || (data.delta as string) || "";
    const store = get();
    const assistantId = store.pendingAssistantIds.get(sessionKey);

    if (eventKind === "delta" || eventKind === "chunk" || eventKind === "token") {
      // Streaming token — append to the pending assistant message
      if (!assistantId) return;
      const sessionMessages = store.messages.get(sessionKey) || [];
      const msg = sessionMessages.find((m) => m.id === assistantId);
      const accumulated = (msg?.content || "") + content;

      get().updateMessage(sessionKey, assistantId, { content: accumulated });
      get().setStreamingState(sessionKey, { partialContent: accumulated });
    } else if (eventKind === "done" || eventKind === "complete" || eventKind === "end") {
      // Stream finished
      if (assistantId) {
        // If a final content payload is included, use it
        if (content) {
          get().updateMessage(sessionKey, assistantId, {
            status: "sent",
            content,
          });
        } else {
          get().updateMessage(sessionKey, assistantId, { status: "sent" });
        }
        get().setPendingAssistantId(sessionKey, null);
      }
      get().setStreamingState(sessionKey, {
        isStreaming: false,
        abortController: null,
        partialContent: "",
      });
    } else if (eventKind === "error") {
      // Stream error
      const errorMsg = (data.error as string) || (data.message as string) || "Unknown error";
      if (assistantId) {
        get().updateMessage(sessionKey, assistantId, {
          status: "error",
          error: errorMsg,
        });
        get().setPendingAssistantId(sessionKey, null);
      }
      get().setStreamingState(sessionKey, {
        isStreaming: false,
        abortController: null,
        partialContent: "",
      });
    } else if (eventKind === "message") {
      // Full message (non-streaming) or a message from another participant
      const role = (data.role as "user" | "assistant" | "system") || "assistant";
      if (assistantId && role === "assistant") {
        get().updateMessage(sessionKey, assistantId, {
          status: "sent",
          content,
        });
        get().setPendingAssistantId(sessionKey, null);
        get().setStreamingState(sessionKey, {
          isStreaming: false,
          abortController: null,
          partialContent: "",
        });
      } else {
        // External message (e.g., from another channel) — append to history
        get().addMessage(sessionKey, {
          id: (data.id as string) || uniqueId("msg-"),
          sessionKey,
          role,
          content,
          timestamp: (data.timestamp as number) || Date.now(),
          status: "sent",
        });
      }
    }
  },

}));
