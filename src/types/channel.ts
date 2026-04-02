/** Information about a channel account. */
export interface ChannelAccount {
  /** Account identifier (e.g., "brokkr", "ibis", or "default"). */
  accountId: string;
  /** Whether the account is configured. */
  configured: boolean;
  /** Whether the account is enabled. */
  enabled: boolean;
  /** Connection status. */
  status: "ok" | "error" | "unconfigured" | "disabled" | "unknown";
  /** Error message if status is "error". */
  error: string | null;
  /** Warnings from audit. */
  warnings: string[];
  /** Last inbound message timestamp (Unix ms). */
  lastInboundAt: number | null;
  /** Last outbound message timestamp (Unix ms). */
  lastOutboundAt: number | null;
  /** Last probe timestamp (Unix ms). */
  lastProbeAt: number | null;
  /** Bot username or display name, if available. */
  botUsername: string | null;
}

/** Information about a connected channel (platform level). */
export interface ChannelInfo {
  /** Channel platform type. */
  type: string;
  /** Channel identifier (same as type for single-account channels). */
  id: string;
  /** Display label from the Gateway UI catalog. */
  label: string;
  /** Channel-level summary status. */
  status: "connected" | "disconnected" | "error" | "partial" | "unconfigured";
  /** Whether the channel is configured at all. */
  configured: boolean;
  /** Per-account breakdown. */
  accounts: ChannelAccount[];
  /** Default account ID. */
  defaultAccountId: string | null;
  /** Total number of accounts. */
  accountCount: number;
  /** Number of accounts in "ok" status. */
  healthyCount: number;
  /** Number of accounts in "error" status. */
  errorCount: number;
}
