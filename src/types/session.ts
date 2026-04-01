/** A session between a user and an agent. */
export interface Session {
  /** Unique session key (e.g., "agent:brokkr:main"). */
  key: string;
  /** Session UUID. */
  sessionId: string;
  /** Parent agent ID. */
  agentId: string;
  /** Channel type (e.g., "webchat", "telegram"). */
  channel: string;
  /** Session kind. */
  kind: "direct" | "subagent";
  /** Model used for this session. */
  model: string;
  /** Session status. */
  status: "active" | "ended";
  /** Creation timestamp (Unix ms). */
  createdAt: number;
  /** Last update timestamp (Unix ms). */
  updatedAt: number;
  /** Token usage for this session. */
  tokens: {
    input: number;
    output: number;
    total: number;
    contextWindow: number;
    percentUsed: number;
  };
  /** Estimated cost in USD. */
  cost: number;
  /** Number of messages in this session. */
  messageCount: number;
}
