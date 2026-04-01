import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all stores before importing the router
const mockSessionStore = {
  handleSessionEvent: vi.fn(),
};
const mockAgentStore = {
  handleAgentEvent: vi.fn(),
  handleSubagentEvent: vi.fn(),
};
const mockCronStore = {
  handleCronEvent: vi.fn(),
};
const mockChannelStore = {
  handleChannelEvent: vi.fn(),
};
const mockUIStore = {
  addToast: vi.fn(),
};

vi.mock("@/stores/sessions", () => ({
  useSessionStore: { getState: () => mockSessionStore },
}));
vi.mock("@/stores/agents", () => ({
  useAgentStore: { getState: () => mockAgentStore },
}));
vi.mock("@/stores/cron", () => ({
  useCronStore: { getState: () => mockCronStore },
}));
vi.mock("@/stores/channels", () => ({
  useChannelStore: { getState: () => mockChannelStore },
}));
vi.mock("@/stores/ui", () => ({
  useUIStore: { getState: () => mockUIStore },
}));

// Mock Tauri events
const mockListenCallback = vi.fn();
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn((_event: string, callback: (event: { payload: unknown }) => void) => {
    mockListenCallback.mockImplementation(callback);
    return Promise.resolve(() => {});
  }),
}));

describe("gateway-event-router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // We need to import after mocks are set up
  async function getRouterModule() {
    // Clear module cache to re-evaluate with mocks
    vi.resetModules();

    // Re-apply mocks after reset
    vi.mock("@/stores/sessions", () => ({
      useSessionStore: { getState: () => mockSessionStore },
    }));
    vi.mock("@/stores/agents", () => ({
      useAgentStore: { getState: () => mockAgentStore },
    }));
    vi.mock("@/stores/cron", () => ({
      useCronStore: { getState: () => mockCronStore },
    }));
    vi.mock("@/stores/channels", () => ({
      useChannelStore: { getState: () => mockChannelStore },
    }));
    vi.mock("@/stores/ui", () => ({
      useUIStore: { getState: () => mockUIStore },
    }));
    vi.mock("@tauri-apps/api/event", () => ({
      listen: vi.fn((_event: string, callback: (event: { payload: unknown }) => void) => {
        mockListenCallback.mockImplementation(callback);
        return Promise.resolve(() => {});
      }),
    }));

    return import("@/services/gateway-event-router");
  }

  it("registers a listener for gateway:event on start", async () => {
    const { startEventRouter } = await getRouterModule();
    const { listen } = await import("@tauri-apps/api/event");
    await startEventRouter();
    expect(listen).toHaveBeenCalledWith("gateway:event", expect.any(Function));
  });

  it("routes session.created to session store", async () => {
    const { startEventRouter } = await getRouterModule();
    await startEventRouter();

    mockListenCallback({
      payload: { event: "session.created", data: { agentId: "brokkr", sessionKey: "s1" } },
    });

    expect(mockSessionStore.handleSessionEvent).toHaveBeenCalledWith(
      "session.created",
      { agentId: "brokkr", sessionKey: "s1" },
    );
  });

  it("routes session.updated to session store", async () => {
    const { startEventRouter } = await getRouterModule();
    await startEventRouter();

    mockListenCallback({
      payload: { event: "session.updated", data: { agentId: "brokkr" } },
    });

    expect(mockSessionStore.handleSessionEvent).toHaveBeenCalledWith(
      "session.updated",
      { agentId: "brokkr" },
    );
  });

  it("routes session.ended to session store", async () => {
    const { startEventRouter } = await getRouterModule();
    await startEventRouter();

    mockListenCallback({
      payload: { event: "session.ended", data: { agentId: "brokkr" } },
    });

    expect(mockSessionStore.handleSessionEvent).toHaveBeenCalledWith(
      "session.ended",
      { agentId: "brokkr" },
    );
  });

  it("routes agent.status to agent store", async () => {
    const { startEventRouter } = await getRouterModule();
    await startEventRouter();

    mockListenCallback({
      payload: { event: "agent.status", data: { agentId: "brokkr", status: "active" } },
    });

    expect(mockAgentStore.handleAgentEvent).toHaveBeenCalledWith({
      agentId: "brokkr",
      status: "active",
    });
  });

  it("routes subagent.spawned to agent store", async () => {
    const { startEventRouter } = await getRouterModule();
    await startEventRouter();

    mockListenCallback({
      payload: {
        event: "subagent.spawned",
        data: { parentAgentId: "brokkr", subagentKey: "s1", label: "QA" },
      },
    });

    expect(mockAgentStore.handleSubagentEvent).toHaveBeenCalledWith(
      "subagent.spawned",
      { parentAgentId: "brokkr", subagentKey: "s1", label: "QA" },
    );
  });

  it("routes subagent.completed to agent store", async () => {
    const { startEventRouter } = await getRouterModule();
    await startEventRouter();

    mockListenCallback({
      payload: { event: "subagent.completed", data: { parentAgentId: "brokkr" } },
    });

    expect(mockAgentStore.handleSubagentEvent).toHaveBeenCalledWith(
      "subagent.completed",
      { parentAgentId: "brokkr" },
    );
  });

  it("routes subagent.failed to agent store", async () => {
    const { startEventRouter } = await getRouterModule();
    await startEventRouter();

    mockListenCallback({
      payload: { event: "subagent.failed", data: { parentAgentId: "brokkr", error: "OOM" } },
    });

    expect(mockAgentStore.handleSubagentEvent).toHaveBeenCalledWith(
      "subagent.failed",
      { parentAgentId: "brokkr", error: "OOM" },
    );
  });

  it("routes cron.run.started to cron store", async () => {
    const { startEventRouter } = await getRouterModule();
    await startEventRouter();

    mockListenCallback({
      payload: { event: "cron.run.started", data: { jobId: "j1", runId: "r1" } },
    });

    expect(mockCronStore.handleCronEvent).toHaveBeenCalledWith(
      "cron.run.started",
      { jobId: "j1", runId: "r1" },
    );
  });

  it("routes cron.run.completed to cron store", async () => {
    const { startEventRouter } = await getRouterModule();
    await startEventRouter();

    mockListenCallback({
      payload: { event: "cron.run.completed", data: { jobId: "j1", status: "ok" } },
    });

    expect(mockCronStore.handleCronEvent).toHaveBeenCalledWith(
      "cron.run.completed",
      { jobId: "j1", status: "ok" },
    );
  });

  it("routes channel.status to channel store", async () => {
    const { startEventRouter } = await getRouterModule();
    await startEventRouter();

    mockListenCallback({
      payload: { event: "channel.status", data: { channelType: "telegram", status: "connected" } },
    });

    expect(mockChannelStore.handleChannelEvent).toHaveBeenCalledWith({
      channelType: "telegram",
      status: "connected",
    });
  });

  it("shows toast for exec.approval events", async () => {
    const { startEventRouter } = await getRouterModule();
    await startEventRouter();

    mockListenCallback({
      payload: {
        event: "exec.approval",
        data: { agentId: "brokkr", command: "rm -rf /tmp/test" },
      },
    });

    expect(mockUIStore.addToast).toHaveBeenCalledWith({
      type: "warning",
      message: "Exec approval needed for brokkr",
      description: "rm -rf /tmp/test",
      duration: null,
    });
  });

  it("shows toast for notification events", async () => {
    const { startEventRouter } = await getRouterModule();
    await startEventRouter();

    mockListenCallback({
      payload: {
        event: "notification",
        data: { severity: "error", message: "Agent crashed" },
      },
    });

    expect(mockUIStore.addToast).toHaveBeenCalledWith({
      type: "error",
      message: "Agent crashed",
    });
  });

  it("handles unknown event type without crashing", async () => {
    const { startEventRouter } = await getRouterModule();
    await startEventRouter();

    // Should not throw
    expect(() => {
      mockListenCallback({
        payload: { event: "unknown.event", data: {} },
      });
    }).not.toThrow();
  });
});
