/**
 * Agent fleet state store.
 *
 * Manages the list of AI agents, their status, and real-time updates
 * from Gateway events.
 */

import { create } from "zustand";
import type { Agent } from "../types/agent";
import { execCliJson } from "../services/tauri-commands";

interface AgentStore {
  /** Map of agent ID → Agent. */
  agents: Map<string, Agent>;
  /** Derived array of all agents (stable reference, updated with Map). */
  agentList: Agent[];
  /** Derived array of active agents (stable reference, updated with Map). */
  activeAgents: Agent[];
  /** Whether the initial fetch is in progress. */
  loading: boolean;
  /** Error from the last fetch attempt. */
  error: string | null;

  // Actions
  /** Fetch the full agent list from the CLI. */
  fetchAgents: () => Promise<void>;
  /** Apply a partial update to a single agent. */
  updateAgent: (agentId: string, patch: Partial<Agent>) => void;
  /** Handle an agent.status Gateway event. */
  handleAgentEvent: (data: Record<string, unknown>) => void;
  /** Handle subagent lifecycle events. */
  handleSubagentEvent: (
    eventType: string,
    data: Record<string, unknown>,
  ) => void;
}

/** Default sparkline data for new agents. */
const emptySparkline = {
  points: [],
  timeRange: { start: Date.now() - 86400000, end: Date.now() },
};

/** Parse CLI agent list output into our Agent type. */
function parseAgentFromCli(raw: Record<string, unknown>): Agent {
  return {
    id: (raw.id as string) || (raw.name as string) || "unknown",
    name: (raw.name as string) || (raw.id as string) || "Unknown",
    emoji: (raw.emoji as string) || "🤖",
    workspace: (raw.workspace as string) || "",
    agentDir: (raw.agentDir as string) || (raw.dir as string) || "",
    model: (raw.model as string) || (raw.defaultModel as string) || "unknown",
    status: "inactive",
    activity: null,
    isDefault: (raw.isDefault as boolean) || false,
    bindings: Array.isArray(raw.bindings) ? raw.bindings : [],
    subagents: [],
    costToday: 0,
    tokensToday: { input: 0, output: 0 },
    burnRate: emptySparkline,
    activeSessionKey: null,
  };
}

/** Derive stable agentList and activeAgents arrays from the agents Map. */
function deriveArrays(agents: Map<string, Agent>) {
  const agentList = Array.from(agents.values());
  const activeAgents = agentList.filter((a) => a.status === "active");
  return { agentList, activeAgents };
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  agents: new Map(),
  agentList: [],
  activeAgents: [],
  loading: false,
  error: null,

  fetchAgents: async () => {
    set({ loading: true, error: null });
    try {
      const rawAgents = await execCliJson<Record<string, unknown>[]>([
        "agents",
        "list",
      ]);

      // Tauri not available — surface a helpful message instead of crashing
      if (rawAgents === null) {
        const empty = new Map<string, Agent>();
        set({
          agents: empty,
          ...deriveArrays(empty),
          loading: false,
          error:
            "Not running inside Tauri. Launch with 'npm run tauri dev'.",
        });
        return;
      }

      const agentMap = new Map<string, Agent>();
      for (const raw of rawAgents) {
        const agent = parseAgentFromCli(raw);
        // Preserve existing status data if we already have this agent
        const existing = get().agents.get(agent.id);
        if (existing) {
          agent.status = existing.status;
          agent.activity = existing.activity;
          agent.subagents = existing.subagents;
          agent.costToday = existing.costToday;
          agent.tokensToday = existing.tokensToday;
          agent.activeSessionKey = existing.activeSessionKey;
        }
        agentMap.set(agent.id, agent);
      }

      // Merge live session data from `openclaw status`
      try {
        const statusData = await execCliJson<any>(["status"]);
        if (statusData?.sessions?.recent) {
          const now = Date.now();
          const fiveMinMs = 5 * 60 * 1000;

          // Calculate start of today (local midnight) for filtering daily metrics
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const todayStartMs = todayStart.getTime();

          // Group sessions by agentId
          const sessionsByAgent = new Map<string, any[]>();
          for (const s of statusData.sessions.recent) {
            const aid = s.agentId as string;
            if (!aid) continue;
            if (!sessionsByAgent.has(aid)) sessionsByAgent.set(aid, []);
            sessionsByAgent.get(aid)!.push(s);
          }

          for (const [agentId, sessions] of sessionsByAgent) {
            const agent = agentMap.get(agentId);
            if (!agent) continue;

            // Sort by updatedAt descending to find most recent
            sessions.sort((a: any, b: any) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
            const mostRecent = sessions[0];

            // Determine active status: session updated within last 5 minutes
            const lastUpdate = mostRecent.updatedAt as number;
            const isActive = lastUpdate && (now - lastUpdate) < fiveMinMs;

            // Sum tokens only from sessions created or updated today
            let totalInput = 0;
            let totalOutput = 0;
            for (const s of sessions) {
              const sessionCreated = (s.createdAt as number) || 0;
              const sessionUpdated = (s.updatedAt as number) || 0;
              // Include session if it was active today (created or last updated today)
              if (sessionCreated >= todayStartMs || sessionUpdated >= todayStartMs) {
                totalInput += (s.inputTokens as number) || 0;
                totalOutput += (s.outputTokens as number) || 0;
              }
            }

            // Estimate cost (Claude Opus: ~$15/M input, ~$75/M output)
            const costEstimate =
              (totalInput / 1_000_000) * 15 +
              (totalOutput / 1_000_000) * 75;

            agent.status = isActive ? "active" : "inactive";
            agent.tokensToday = { input: totalInput, output: totalOutput };
            agent.costToday = costEstimate;
            agent.model = (mostRecent.model as string) || agent.model;
            agent.activeSessionKey = (mostRecent.key as string) || null;
          }
        }
      } catch (statusErr) {
        // Non-fatal: status fetch failed, agent list still valid
        console.warn("Failed to fetch status data:", statusErr);
      }

      set({ agents: agentMap, ...deriveArrays(agentMap), loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : String(err),
        loading: false,
      });
    }
  },

  updateAgent: (agentId: string, patch: Partial<Agent>) => {
    const agents = new Map(get().agents);
    const existing = agents.get(agentId);
    if (existing) {
      agents.set(agentId, { ...existing, ...patch });
      set({ agents, ...deriveArrays(agents) });
    }
  },

  handleAgentEvent: (data: Record<string, unknown>) => {
    const agentId = data.agentId as string;
    if (!agentId) return;
    get().updateAgent(agentId, {
      status: (data.status as Agent["status"]) || "inactive",
      activity: (data.activity as string) || null,
    });
  },

  handleSubagentEvent: (
    eventType: string,
    data: Record<string, unknown>,
  ) => {
    const agentId = data.parentAgentId as string;
    if (!agentId) return;
    const agents = new Map(get().agents);
    const agent = agents.get(agentId);
    if (!agent) return;

    const subKey = data.subagentKey as string;
    const subagents = [...agent.subagents];
    const idx = subagents.findIndex((s) => s.key === subKey);

    if (eventType === "subagent.spawned") {
      subagents.push({
        key: subKey,
        label: (data.label as string) || subKey,
        status: "running",
        model: (data.model as string) || agent.model,
        startedAt: Date.now(),
        endedAt: null,
        durationMs: 0,
        tokens: null,
        error: null,
      });
    } else if (idx >= 0) {
      if (eventType === "subagent.completed") {
        subagents[idx] = {
          ...subagents[idx],
          status: "completed",
          endedAt: Date.now(),
          durationMs: (data.durationMs as number) || 0,
        };
      } else if (eventType === "subagent.failed") {
        subagents[idx] = {
          ...subagents[idx],
          status: "failed",
          endedAt: Date.now(),
          durationMs: (data.durationMs as number) || 0,
          error: (data.error as string) || "Unknown error",
        };
      }
    }

    agents.set(agentId, { ...agent, subagents });
    set({ agents, ...deriveArrays(agents) });
  },
}));
