/**
 * Shared mock data factories for tests.
 */
import type { Agent } from "@/types/agent";
import type { ChatMessage, ChatCompletionChunk } from "@/types/chat";
import type { CronJob, CronRun } from "@/types/cron";
import type { ChannelInfo } from "@/types/channel";
import type { Session } from "@/types/session";

export function createMockAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "brokkr",
    name: "Brokkr",
    emoji: "⚒️",
    workspace: "/Users/test/.openclaw/workspace-brokkr",
    agentDir: "/Users/test/.openclaw/agents/brokkr",
    model: "claude-opus-4-6",
    status: "active",
    activity: "Working on TASK-002",
    isDefault: false,
    bindings: [],
    subagents: [],
    costToday: 2.4,
    tokensToday: { input: 50000, output: 30000 },
    burnRate: {
      points: [],
      timeRange: { start: Date.now() - 86400000, end: Date.now() },
    },
    activeSessionKey: "agent:brokkr:main",
    ...overrides,
  };
}

export function createMockChatMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: `msg-${Date.now()}`,
    sessionKey: "agent:brokkr:main",
    role: "user",
    content: "Hello, Brokkr!",
    timestamp: Date.now(),
    status: "sent",
    ...overrides,
  };
}

export function createMockCronJob(overrides: Partial<CronJob> = {}): CronJob {
  return {
    id: "job-001",
    agentId: "brokkr",
    name: "Daily Digest",
    enabled: true,
    schedule: {
      kind: "cron",
      expr: "0 9 * * *",
      tz: "America/Los_Angeles",
    },
    payload: {
      kind: "agentTurn",
      message: "Check emails and summarize inbox",
      timeoutSeconds: 120,
    },
    modelOverride: null,
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 3600000,
    state: {
      nextRunAtMs: Date.now() + 3600000,
      lastRunAtMs: Date.now() - 86400000,
      lastRunStatus: "ok",
      lastDurationMs: 45000,
      consecutiveErrors: 0,
      lastError: null,
    },
    ...overrides,
  };
}

export function createMockCronRun(overrides: Partial<CronRun> = {}): CronRun {
  return {
    runId: "run-001",
    jobId: "job-001",
    trigger: "scheduled",
    startedAt: Date.now() - 60000,
    endedAt: Date.now(),
    durationMs: 60000,
    status: "ok",
    output: null,
    error: null,
    ...overrides,
  };
}

export function createMockChannel(overrides: Partial<ChannelInfo> = {}): ChannelInfo {
  return {
    type: "webchat",
    id: "webchat-1",
    status: "connected",
    agentId: "brokkr",
    agentName: "Brokkr",
    agentEmoji: "⚒️",
    lastMessageAt: Date.now() - 300000,
    error: null,
    disconnectedAt: null,
    ...overrides,
  };
}

export function createMockSession(overrides: Partial<Session> = {}): Session {
  return {
    key: "agent:brokkr:main",
    sessionId: "sess-001",
    agentId: "brokkr",
    channel: "webchat",
    kind: "direct",
    model: "claude-opus-4-6",
    status: "active",
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now() - 60000,
    tokens: {
      input: 50000,
      output: 30000,
      total: 80000,
      contextWindow: 200000,
      percentUsed: 40,
    },
    cost: 2.4,
    messageCount: 25,
    ...overrides,
  };
}

export function createMockSSEChunk(content: string): ChatCompletionChunk {
  return {
    id: "chatcmpl-test",
    object: "chat.completion.chunk",
    choices: [
      {
        delta: { content },
        index: 0,
        finish_reason: null,
      },
    ],
  };
}

/**
 * Create a mock ReadableStream that yields SSE-formatted chunks.
 */
export function createMockSSEStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        const chunk = createMockSSEChunk(chunks[index]);
        const line = `data: ${JSON.stringify(chunk)}\n\n`;
        controller.enqueue(encoder.encode(line));
        index++;
      } else {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });
}
