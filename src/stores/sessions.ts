/**
 * Session state store.
 *
 * Tracks active and recent sessions across all agents,
 * updated via Gateway WebSocket events.
 */

import { create } from "zustand";
import type { Session } from "../types/session";
import { execCliJson } from "../services/tauri-commands";

interface SessionStore {
  /** Map of session key → Session. */
  sessions: Map<string, Session>;
  /** Agent ID → list of session keys. */
  byAgent: Map<string, string[]>;
  /** Whether the initial fetch is in progress. */
  loading: boolean;

  // Actions
  /** Fetch sessions from the CLI (optionally filtered by agent). */
  fetchSessions: (agentId?: string) => Promise<void>;
  /** Apply a partial update to a session. */
  updateSession: (key: string, patch: Partial<Session>) => void;
  /** Handle session lifecycle events from the Gateway. */
  handleSessionEvent: (
    eventType: string,
    data: Record<string, unknown>,
  ) => void;


}

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: new Map(),
  byAgent: new Map(),
  loading: false,

  fetchSessions: async (agentId?: string) => {
    set({ loading: true });
    try {
      const args = ["sessions", "--all-agents"];
      if (agentId) {
        args.push("--agent", agentId);
      }
      const rawSessions = await execCliJson<Record<string, unknown>[]>(args);

      // Tauri not available
      if (rawSessions === null) {
        set({ loading: false });
        return;
      }

      const sessions = new Map(get().sessions);
      const byAgent = new Map(get().byAgent);

      // The CLI returns { sessions: [...] } wrapper
      const sessionList = Array.isArray(rawSessions)
        ? rawSessions
        : (rawSessions as any)?.sessions ?? [];

      for (const raw of sessionList) {
        const inputTokens = (raw.inputTokens as number) || 0;
        const outputTokens = (raw.outputTokens as number) || 0;
        const totalTokens = (raw.totalTokens as number) || (inputTokens + outputTokens);
        const contextTokens = (raw.contextTokens as number) || 200000;

        // Estimate cost (Claude Opus: ~$15/M input, ~$75/M output)
        const estimatedCost =
          (inputTokens / 1_000_000) * 15 +
          (outputTokens / 1_000_000) * 75;

        // Determine if session is active: updated within last 5 minutes
        const updatedAt = (raw.updatedAt as number) || Date.now();
        const ageMs = (raw.ageMs as number) || 0;
        const isActive = ageMs < 5 * 60 * 1000;

        const session: Session = {
          key: (raw.key as string) || (raw.sessionKey as string) || "",
          sessionId: (raw.sessionId as string) || "",
          agentId: (raw.agentId as string) || "",
          channel: (raw.channel as string) || "unknown",
          kind: (raw.kind as "direct" | "subagent") || "direct",
          model: (raw.model as string) || "unknown",
          status: isActive ? "active" : "ended",
          createdAt: (raw.createdAt as number) || updatedAt,
          updatedAt,
          tokens: {
            input: inputTokens,
            output: outputTokens,
            total: totalTokens,
            contextWindow: contextTokens,
            percentUsed: contextTokens > 0 ? Math.round((totalTokens / contextTokens) * 100) : 0,
          },
          cost: estimatedCost,
          messageCount: (raw.messageCount as number) || 0,
        };

        sessions.set(session.key, session);

        if (session.agentId) {
          const agentSessions = byAgent.get(session.agentId) || [];
          if (!agentSessions.includes(session.key)) {
            agentSessions.push(session.key);
          }
          byAgent.set(session.agentId, agentSessions);
        }
      }

      set({ sessions, byAgent, loading: false });
    } catch (err) {
      console.error("Failed to fetch sessions:", err);
      set({ loading: false });
    }
  },

  updateSession: (key: string, patch: Partial<Session>) => {
    const sessions = new Map(get().sessions);
    const existing = sessions.get(key);
    if (existing) {
      sessions.set(key, { ...existing, ...patch });
      set({ sessions });
    }
  },

  handleSessionEvent: (
    eventType: string,
    data: Record<string, unknown>,
  ) => {
    const key =
      (data.sessionKey as string) || (data.key as string) || "";
    if (!key) return;

    if (eventType === "session.created") {
      const sessions = new Map(get().sessions);
      const byAgent = new Map(get().byAgent);
      const agentId = (data.agentId as string) || "";

      const session: Session = {
        key,
        sessionId: (data.sessionId as string) || "",
        agentId,
        channel: (data.channel as string) || "unknown",
        kind: "direct",
        model: (data.model as string) || "unknown",
        status: "active",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tokens: { input: 0, output: 0, total: 0, contextWindow: 0, percentUsed: 0 },
        cost: 0,
        messageCount: 0,
      };

      sessions.set(key, session);
      if (agentId) {
        const agentSessions = byAgent.get(agentId) || [];
        if (!agentSessions.includes(key)) {
          agentSessions.push(key);
        }
        byAgent.set(agentId, agentSessions);
      }
      set({ sessions, byAgent });
    } else if (eventType === "session.updated") {
      get().updateSession(key, {
        updatedAt: Date.now(),
        tokens: data.tokens as Session["tokens"],
        model: data.model as string,
      });
    } else if (eventType === "session.ended") {
      get().updateSession(key, { status: "ended", updatedAt: Date.now() });
    }
  },

}));
