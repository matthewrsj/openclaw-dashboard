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

  // Selectors
  /** Get all sessions for a specific agent. */
  getSessionsForAgent: (agentId: string) => Session[];
  /** Get only active sessions for an agent. */
  getActiveSessionsForAgent: (agentId: string) => Session[];
  /** Get total session count. */
  getSessionCount: () => number;
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

      const sessions = new Map(get().sessions);
      const byAgent = new Map(get().byAgent);

      for (const raw of rawSessions) {
        const session: Session = {
          key: (raw.key as string) || (raw.sessionKey as string) || "",
          sessionId: (raw.sessionId as string) || "",
          agentId: (raw.agentId as string) || "",
          channel: (raw.channel as string) || "unknown",
          kind: (raw.kind as "direct" | "subagent") || "direct",
          model: (raw.model as string) || "unknown",
          status: (raw.status as "active" | "ended") || "active",
          createdAt: (raw.createdAt as number) || Date.now(),
          updatedAt: (raw.updatedAt as number) || Date.now(),
          tokens: {
            input: ((raw.tokens as Record<string, number>)?.input as number) || 0,
            output: ((raw.tokens as Record<string, number>)?.output as number) || 0,
            total: ((raw.tokens as Record<string, number>)?.total as number) || 0,
            contextWindow: ((raw.tokens as Record<string, number>)?.contextWindow as number) || 0,
            percentUsed: ((raw.tokens as Record<string, number>)?.percentUsed as number) || 0,
          },
          cost: (raw.cost as number) || 0,
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

  getSessionsForAgent: (agentId: string) => {
    const keys = get().byAgent.get(agentId) || [];
    return keys
      .map((k) => get().sessions.get(k))
      .filter((s): s is Session => s !== undefined);
  },

  getActiveSessionsForAgent: (agentId: string) =>
    get()
      .getSessionsForAgent(agentId)
      .filter((s) => s.status === "active"),

  getSessionCount: () => get().sessions.size,
}));
