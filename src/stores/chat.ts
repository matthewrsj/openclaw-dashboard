/**
 * Chat state store.
 *
 * Manages chat messages, drafts, streaming state, and scroll positions
 * for all agent conversations.
 */

import { create } from "zustand";
import type { ChatMessage, StreamingState } from "../types/chat";

/**
 * Extract plain text from a Gateway chat message payload.
 *
 * The Gateway sends messages as:
 *   { role: "assistant", content: [{ type: "text", text: "..." }, ...], timestamp }
 *
 * Returns the concatenated text, or null if the message is missing/unparseable.
 */
function extractTextFromMessage(message: unknown): string | null {
  if (!message || typeof message !== "object") return null;
  const msg = message as Record<string, unknown>;
  const content = msg.content;

  // content is an array of content blocks
  if (Array.isArray(content)) {
    return content
      .filter(
        (block: unknown): block is { type: string; text: string } =>
          typeof block === "object" &&
          block !== null &&
          (block as Record<string, unknown>).type === "text" &&
          typeof (block as Record<string, unknown>).text === "string",
      )
      .map((block) => block.text)
      .join("");
  }

  // Fallback: content might be a plain string
  if (typeof content === "string") return content;

  return null;
}

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
    const sessionKey = (data.sessionKey as string) || "";
    if (!sessionKey) return;

    // Gateway ChatEvent: { runId, sessionKey, seq, state, message?, errorMessage?, usage?, stopReason? }
    // message format: { role, content: [{ type: "text", text: "..." }, ...], timestamp }
    // content is cumulative (full text so far), not incremental deltas
    const state = (data.state as string) || "";
    const store = get();
    const assistantId = store.pendingAssistantIds.get(sessionKey);

    if (state === "delta") {
      if (!assistantId) return;
      const text = extractTextFromMessage(data.message);
      if (text === null) return;

      // text is cumulative — replace, don't append
      get().updateMessage(sessionKey, assistantId, { content: text });
      get().setStreamingState(sessionKey, { partialContent: text });
    } else if (state === "final") {
      if (assistantId) {
        const text = extractTextFromMessage(data.message);
        if (text !== null) {
          get().updateMessage(sessionKey, assistantId, {
            status: "sent",
            content: text,
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
    } else if (state === "aborted") {
      if (assistantId) {
        get().updateMessage(sessionKey, assistantId, { status: "sent" });
        get().setPendingAssistantId(sessionKey, null);
      }
      get().setStreamingState(sessionKey, {
        isStreaming: false,
        abortController: null,
        partialContent: "",
      });
    } else if (state === "error") {
      const errorMsg = (data.errorMessage as string) || "Unknown error";
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
    }
  },

}));
