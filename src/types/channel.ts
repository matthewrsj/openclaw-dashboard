/** Information about a connected channel. */
export interface ChannelInfo {
  /** Channel platform type. */
  type: "telegram" | "whatsapp" | "discord" | "webchat" | "slack" | "signal";
  /** Channel identifier. */
  id: string;
  /** Connection status. */
  status: "connected" | "disconnected" | "error" | "unbound";
  /** Agent bound to this channel, or null. */
  agentId: string | null;
  /** Agent display name. */
  agentName: string | null;
  /** Agent emoji. */
  agentEmoji: string | null;
  /** Timestamp of last message (Unix ms), or null. */
  lastMessageAt: number | null;
  /** Error message if status is "error". */
  error: string | null;
  /** When the channel disconnected (Unix ms), or null. */
  disconnectedAt: number | null;
}
