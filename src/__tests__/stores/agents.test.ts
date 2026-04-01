import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAgentStore } from "@/stores/agents";
import { createMockAgent } from "../helpers/mock-data";

// Mock tauri-commands
vi.mock("@/services/tauri-commands", () => ({
  execCliJson: vi.fn(),
  gatewayRpc: vi.fn(),
}));

describe("AgentStore", () => {
  beforeEach(() => {
    // Reset store between tests
    useAgentStore.setState({
      agents: new Map(),
      loading: false,
      error: null,
    });
  });

  describe("initial state", () => {
    it("starts with empty agents map", () => {
      const state = useAgentStore.getState();
      expect(state.agents.size).toBe(0);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe("fetchAgents", () => {
    it("sets loading to true during fetch", async () => {
      const { execCliJson } = await import("@/services/tauri-commands");
      (execCliJson as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise(() => {}), // never resolves
      );

      // Start fetch but don't await
      useAgentStore.getState().fetchAgents();
      expect(useAgentStore.getState().loading).toBe(true);
    });

    it("populates agents from CLI output", async () => {
      const { execCliJson } = await import("@/services/tauri-commands");
      (execCliJson as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: "brokkr", name: "Brokkr", emoji: "⚒️", model: "claude-opus-4-6", workspace: "/test" },
        { id: "nikola", name: "Nikola", emoji: "⚡", model: "gpt-4o", workspace: "/test2" },
      ]);

      await useAgentStore.getState().fetchAgents();
      const state = useAgentStore.getState();
      expect(state.agents.size).toBe(2);
      expect(state.agents.get("brokkr")?.name).toBe("Brokkr");
      expect(state.agents.get("nikola")?.emoji).toBe("⚡");
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it("sets error on fetch failure", async () => {
      const { execCliJson } = await import("@/services/tauri-commands");
      (execCliJson as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("CLI not found"),
      );

      await useAgentStore.getState().fetchAgents();
      const state = useAgentStore.getState();
      expect(state.error).toBe("CLI not found");
      expect(state.loading).toBe(false);
    });

    it("preserves existing runtime state on re-fetch", async () => {
      // Pre-populate with an agent that has runtime state
      const existing = createMockAgent({ id: "brokkr", status: "active", activity: "Testing" });
      useAgentStore.setState({
        agents: new Map([["brokkr", existing]]),
      });

      const { execCliJson } = await import("@/services/tauri-commands");
      (execCliJson as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: "brokkr", name: "Brokkr", emoji: "⚒️", model: "claude-opus-4-6" },
      ]);

      await useAgentStore.getState().fetchAgents();
      const agent = useAgentStore.getState().agents.get("brokkr")!;
      expect(agent.status).toBe("active"); // preserved
      expect(agent.activity).toBe("Testing"); // preserved
    });
  });

  describe("updateAgent", () => {
    it("applies partial update to existing agent", () => {
      const agent = createMockAgent({ id: "brokkr", status: "inactive" });
      useAgentStore.setState({ agents: new Map([["brokkr", agent]]) });

      useAgentStore.getState().updateAgent("brokkr", { status: "active" });
      expect(useAgentStore.getState().agents.get("brokkr")?.status).toBe("active");
    });

    it("does nothing for non-existent agent", () => {
      useAgentStore.getState().updateAgent("nonexistent", { status: "active" });
      expect(useAgentStore.getState().agents.size).toBe(0);
    });
  });

  describe("handleAgentEvent", () => {
    it("updates agent status from event data", () => {
      const agent = createMockAgent({ id: "brokkr", status: "inactive" });
      useAgentStore.setState({ agents: new Map([["brokkr", agent]]) });

      useAgentStore.getState().handleAgentEvent({
        agentId: "brokkr",
        status: "active",
        activity: "Processing request",
      });

      const updated = useAgentStore.getState().agents.get("brokkr")!;
      expect(updated.status).toBe("active");
      expect(updated.activity).toBe("Processing request");
    });

    it("ignores events without agentId", () => {
      const agent = createMockAgent({ id: "brokkr" });
      useAgentStore.setState({ agents: new Map([["brokkr", agent]]) });

      useAgentStore.getState().handleAgentEvent({ status: "error" });
      expect(useAgentStore.getState().agents.get("brokkr")?.status).toBe("active");
    });
  });

  describe("handleSubagentEvent", () => {
    it("adds subagent on spawned event", () => {
      const agent = createMockAgent({ id: "brokkr", subagents: [] });
      useAgentStore.setState({ agents: new Map([["brokkr", agent]]) });

      useAgentStore.getState().handleSubagentEvent("subagent.spawned", {
        parentAgentId: "brokkr",
        subagentKey: "sub-1",
        label: "QA Engineer",
        model: "claude-opus-4-6",
      });

      const updated = useAgentStore.getState().agents.get("brokkr")!;
      expect(updated.subagents).toHaveLength(1);
      expect(updated.subagents[0].label).toBe("QA Engineer");
      expect(updated.subagents[0].status).toBe("running");
    });

    it("marks subagent completed on completed event", () => {
      const agent = createMockAgent({
        id: "brokkr",
        subagents: [
          {
            key: "sub-1",
            label: "QA",
            status: "running",
            model: "claude-opus-4-6",
            startedAt: Date.now(),
            endedAt: null,
            durationMs: 0,
            tokens: null,
            error: null,
          },
        ],
      });
      useAgentStore.setState({ agents: new Map([["brokkr", agent]]) });

      useAgentStore.getState().handleSubagentEvent("subagent.completed", {
        parentAgentId: "brokkr",
        subagentKey: "sub-1",
        durationMs: 45000,
      });

      const updated = useAgentStore.getState().agents.get("brokkr")!;
      expect(updated.subagents[0].status).toBe("completed");
      expect(updated.subagents[0].durationMs).toBe(45000);
    });

    it("marks subagent failed on failed event", () => {
      const agent = createMockAgent({
        id: "brokkr",
        subagents: [
          {
            key: "sub-1",
            label: "QA",
            status: "running",
            model: "claude-opus-4-6",
            startedAt: Date.now(),
            endedAt: null,
            durationMs: 0,
            tokens: null,
            error: null,
          },
        ],
      });
      useAgentStore.setState({ agents: new Map([["brokkr", agent]]) });

      useAgentStore.getState().handleSubagentEvent("subagent.failed", {
        parentAgentId: "brokkr",
        subagentKey: "sub-1",
        error: "Out of context",
        durationMs: 30000,
      });

      const updated = useAgentStore.getState().agents.get("brokkr")!;
      expect(updated.subagents[0].status).toBe("failed");
      expect(updated.subagents[0].error).toBe("Out of context");
    });
  });

  describe("selectors", () => {
    beforeEach(() => {
      const agents = new Map([
        ["brokkr", createMockAgent({ id: "brokkr", status: "active" })],
        ["nikola", createMockAgent({ id: "nikola", status: "inactive" })],
        ["huginn", createMockAgent({ id: "huginn", status: "active" })],
      ]);
      useAgentStore.setState({ agents });
    });

    it("agents.get returns the correct agent", () => {
      expect(useAgentStore.getState().agents.get("brokkr")?.id).toBe("brokkr");
    });

    it("agents.get returns undefined for missing agent", () => {
      expect(useAgentStore.getState().agents.get("nonexistent")).toBeUndefined();
    });

    it("agentList returns all agents as array", () => {
      expect(useAgentStore.getState().agentList).toHaveLength(3);
    });

    it("activeAgents returns only active agents", () => {
      const active = useAgentStore.getState().activeAgents;
      expect(active).toHaveLength(2);
      expect(active.every((a) => a.status === "active")).toBe(true);
    });

    it("agentList.length returns total count", () => {
      expect(useAgentStore.getState().agentList.length).toBe(3);
    });
  });
});
