/** Gateway connection state. */
export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting";

/** Gateway health response. */
export interface GatewayHealth {
  ok: boolean;
  ts: number;
  durationMs: number;
  version: string;
  channels: Record<string, ChannelHealthDetail>;
}

/** Health detail for a single channel. */
export interface ChannelHealthDetail {
  status: string;
  latency?: number;
  error?: string;
}

/** Gateway status response. */
export interface GatewayStatus {
  runtimeVersion: string;
  heartbeat: {
    defaultAgentId: string;
    agents: Array<{ agentId: string; enabled: boolean; every: string }>;
  };
  channelSummary: string[];
  sessions: {
    count: number;
    defaults: { model: string; contextTokens: number };
    recent: Array<Record<string, unknown>>;
  };
}

/** Event payload emitted by the Tauri backend. */
export interface GatewayEventPayload {
  event: string;
  data: Record<string, unknown>;
}

/** Connection event payload. */
export interface ConnectionEventPayload {
  url: string;
}

/** Disconnection event payload. */
export interface DisconnectEventPayload {
  reason: string;
  willRetry: boolean;
}

/** Reconnecting event payload. */
export interface ReconnectingEventPayload {
  attempt: number;
  delayMs: number;
}
