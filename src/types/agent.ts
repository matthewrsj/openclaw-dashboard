/** Agent status type. */
export type AgentStatus = "active" | "inactive" | "error";

/** Sparkline data for visualizing time-series metrics. */
export interface SparklineData {
  points: Array<{ timestamp: number; value: number }>;
  timeRange: { start: number; end: number };
}

/** Channel binding for an agent. */
export interface ChannelBinding {
  channelType: string;
  channelId: string;
  bound: boolean;
}

/** A subagent spawned by an agent. */
export interface Subagent {
  /** Session key. */
  key: string;
  /** Human-readable label. */
  label: string;
  /** Current execution status. */
  status: "running" | "completed" | "failed" | "pending";
  /** Model used by the subagent. */
  model: string;
  /** Start timestamp (Unix ms). */
  startedAt: number;
  /** End timestamp (Unix ms) or null if still running. */
  endedAt: number | null;
  /** Duration in milliseconds. */
  durationMs: number;
  /** Token usage, if available. */
  tokens: { input: number; output: number; total: number } | null;
  /** Error message, if failed. */
  error: string | null;
}

/** An AI agent in the OpenClaw fleet. */
export interface Agent {
  /** Unique agent identifier (e.g., "brokkr"). */
  id: string;
  /** Display name (e.g., "Brokkr"). */
  name: string;
  /** Emoji identifier (e.g., "⚒️"). */
  emoji: string;
  /** Absolute path to the agent's workspace directory. */
  workspace: string;
  /** Agent configuration directory. */
  agentDir: string;
  /** Default model (e.g., "claude-opus-4-6"). */
  model: string;
  /** Current status. */
  status: AgentStatus;
  /** Description of current task, or null if idle. */
  activity: string | null;
  /** Whether this is the default agent. */
  isDefault: boolean;
  /** Channel bindings. */
  bindings: ChannelBinding[];
  /** Active subagents. */
  subagents: Subagent[];
  /** Estimated cost today in USD. */
  costToday: number;
  /** Token usage today. */
  tokensToday: { input: number; output: number };
  /** 24-hour burn rate sparkline data. */
  burnRate: SparklineData;
  /** Key of the currently active session, or null. */
  activeSessionKey: string | null;
}
