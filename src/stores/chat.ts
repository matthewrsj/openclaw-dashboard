/**
 * Chat state store.
 *
 * Manages chat messages, drafts, streaming state, and scroll positions
 * for all agent conversations.
 */

import { create } from "zustand";
import type { ChatMessage, StreamingState } from "../types/chat";
import { gatewayRpc } from "../services/tauri-commands";
import { uniqueId } from "../lib/utils";

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
  /** Map of session key → queued messages. */
  messageQueues: Map<string, string[]>;
  /** Currently active agent ID for chat. */
  activeAgentId: string | null;
  /** Map of session key → pending assistant message ID (awaiting streamed response). */
  pendingAssistantIds: Map<string, string>;
  /** Map of runId → { sessionKey, messageId } for correlating chat events. */
  pendingRuns: Map<string, { sessionKey: string; messageId: string }>;

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
  /** Queue a message for a session (sent when streaming ends). */
  enqueueMessage: (sessionKey: string, message: string) => void;
  /** Remove a queued message by index. */
  dequeueMessage: (sessionKey: string, index: number) => void;
  /** Clear all queued messages for a session. */
  clearQueue: (sessionKey: string) => void;
  /** Flush the queue for a session (returns combined message or null). */
  flushQueue: (sessionKey: string) => string | null;
  /** Track the pending assistant message ID for streaming updates. */
  setPendingAssistantId: (sessionKey: string, messageId: string | null) => void;
  /** Register a pending run for correlating chat events by runId. */
  registerPendingRun: (runId: string, sessionKey: string, messageId: string) => void;
  /** Load chat history from the Gateway for a session. */
  loadHistory: (sessionKey: string) => Promise<void>;
  /** Set of session keys that have already been loaded. */
  loadedSessions: Set<string>;
  /** Clean up tracking state for a completed run. */
  cleanupPendingRun: (runId: string, sessionKey: string) => void;
  /** Handle a chat stream event from the Gateway. */
  handleChatEvent: (data: Record<string, unknown>) => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: new Map(),
  drafts: new Map(),
  scrollPositions: new Map(),
  streamingState: new Map(),
  messageQueues: new Map(),
  activeAgentId: null,
  pendingAssistantIds: new Map(),
  pendingRuns: new Map(),
  loadedSessions: new Set(),

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

  enqueueMessage: (sessionKey: string, message: string) => {
    const queues = new Map(get().messageQueues);
    const q = [...(queues.get(sessionKey) || []), message];
    queues.set(sessionKey, q);
    set({ messageQueues: queues });
  },

  dequeueMessage: (sessionKey: string, index: number) => {
    const queues = new Map(get().messageQueues);
    const q = [...(queues.get(sessionKey) || [])];
    q.splice(index, 1);
    if (q.length === 0) queues.delete(sessionKey);
    else queues.set(sessionKey, q);
    set({ messageQueues: queues });
  },

  clearQueue: (sessionKey: string) => {
    const queues = new Map(get().messageQueues);
    queues.delete(sessionKey);
    set({ messageQueues: queues });
  },

  flushQueue: (sessionKey: string) => {
    const queues = new Map(get().messageQueues);
    const q = queues.get(sessionKey);
    if (!q || q.length === 0) return null;
    queues.delete(sessionKey);
    set({ messageQueues: queues });
    return q.join("\n\n");
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

  registerPendingRun: (runId: string, sessionKey: string, messageId: string) => {
    const pendingRuns = new Map(get().pendingRuns);
    pendingRuns.set(runId, { sessionKey, messageId });
    set({ pendingRuns });
  },

  loadHistory: async (sessionKey: string) => {
    // Don't reload if already loaded
    if (get().loadedSessions.has(sessionKey)) return;

    try {
      const result = await gatewayRpc<{
        sessionKey: string;
        messages: Array<{
          role: string;
          content: unknown;
          timestamp?: number;
          id?: string;
        }>;
      }>("chat.history", { sessionKey, limit: 100 });

      if (!result || !result.messages) return;

      const messages = new Map(get().messages);
      const parsed: ChatMessage[] = [];

      for (const msg of result.messages) {
        // Extract text from content (may be string or content blocks array)
        let text = "";
        if (typeof msg.content === "string") {
          text = msg.content;
        } else if (Array.isArray(msg.content)) {
          text = (msg.content as Array<{ type?: string; text?: string }>)
            .filter((b) => b.type === "text" && typeof b.text === "string")
            .map((b) => b.text!)
            .join("");
        }

        // Skip empty system messages and tool results
        const role = msg.role as ChatMessage["role"];
        if (role !== "user" && role !== "assistant") continue;
        if (!text.trim()) continue;

        parsed.push({
          id: msg.id || uniqueId("hist-"),
          sessionKey,
          role,
          content: text,
          timestamp: msg.timestamp || Date.now(),
          status: "sent",
        });
      }

      messages.set(sessionKey, parsed);
      const loadedSessions = new Set(get().loadedSessions);
      loadedSessions.add(sessionKey);
      set({ messages, loadedSessions });
    } catch (err) {
      console.warn("Failed to load chat history:", err);
    }
  },

  cleanupPendingRun: (runId: string, sessionKey: string) => {
    const pendingRuns = new Map(get().pendingRuns);
    pendingRuns.delete(runId);
    const pendingAssistantIds = new Map(get().pendingAssistantIds);
    pendingAssistantIds.delete(sessionKey);
    set({
      pendingRuns,
      pendingAssistantIds,
      streamingState: (() => {
        const s = new Map(get().streamingState);
        s.set(sessionKey, { isStreaming: false, abortController: null, partialContent: "" });
        return s;
      })(),
    });
  },

  handleChatEvent: (data: Record<string, unknown>) => {
    // Gateway ChatEvent: { runId, sessionKey, seq, state, message?, errorMessage?, usage?, stopReason? }
    // message format: { role, content: [{ type: "text", text: "..." }, ...], timestamp }
    // content is cumulative (full text so far), not incremental deltas
    //
    // Correlate by runId (= idempotencyKey) since the Gateway may normalize
    // the sessionKey to a canonical form different from what we sent.
    const runId = (data.runId as string) || "";
    const state = (data.state as string) || "";
    const store = get();

    // Look up the pending run by runId
    const pending = store.pendingRuns.get(runId);
    if (!pending) return; // Not one of our runs

    const { sessionKey, messageId } = pending;

    if (state === "delta") {
      const text = extractTextFromMessage(data.message);
      if (text === null) return;

      // text is cumulative — replace, don't append
      get().updateMessage(sessionKey, messageId, { content: text });
      get().setStreamingState(sessionKey, { partialContent: text });
    } else if (state === "final") {
      const text = extractTextFromMessage(data.message);
      if (text !== null) {
        get().updateMessage(sessionKey, messageId, {
          status: "sent",
          content: text,
        });
      } else {
        get().updateMessage(sessionKey, messageId, { status: "sent" });
      }
      get().cleanupPendingRun(runId, sessionKey);
    } else if (state === "aborted") {
      get().updateMessage(sessionKey, messageId, { status: "sent" });
      get().cleanupPendingRun(runId, sessionKey);
    } else if (state === "error") {
      const errorMsg = (data.errorMessage as string) || "Unknown error";
      get().updateMessage(sessionKey, messageId, {
        status: "error",
        error: errorMsg,
      });
      get().cleanupPendingRun(runId, sessionKey);
    }
  },

}));
