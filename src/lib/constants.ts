/**
 * Application-wide constants.
 */

/** Default Gateway URL. */
export const DEFAULT_GATEWAY_URL = "ws://localhost:18789";

/** Agent status colors. */
export const AGENT_STATUS_COLORS = {
  active: "text-status-success",
  inactive: "text-text-tertiary",
  error: "text-status-error",
} as const;

/** Session status colors. */
export const SESSION_STATUS_COLORS = {
  active: "text-status-success",
  ended: "text-text-tertiary",
} as const;

/** Channel status colors. */
export const CHANNEL_STATUS_COLORS = {
  connected: "text-status-success",
  disconnected: "text-text-tertiary",
  error: "text-status-error",
  unbound: "text-status-warning",
} as const;

/** Cron job status colors. */
export const CRON_STATUS_COLORS = {
  ok: "text-status-success",
  error: "text-status-error",
  skipped: "text-status-warning",
  running: "text-status-info",
} as const;

/** Toast type colors. */
export const TOAST_COLORS = {
  success: "border-status-success text-status-success",
  error: "border-status-error text-status-error",
  warning: "border-status-warning text-status-warning",
  info: "border-status-info text-status-info",
} as const;

/** Virtual scrolling item heights (estimated). */
export const VIRTUAL_SCROLL_HEIGHTS = {
  chatMessage: 80,
  sessionRow: 44,
  logLine: 20,
} as const;

/** Animation durations in milliseconds. */
export const ANIMATION_DURATION = {
  fast: 150,
  normal: 200,
  slow: 300,
} as const;

/** Keyboard shortcuts. */
export const SHORTCUTS = {
  commandPalette: ["Meta+k", "Ctrl+k"],
  toggleSidebar: ["Meta+b", "Ctrl+b"],
  newChat: ["Meta+n", "Ctrl+n"],
  settings: ["Meta+comma", "Ctrl+comma"],
} as const;

/** File size limits. */
export const FILE_LIMITS = {
  maxWorkspaceFileSize: 1024 * 1024, // 1MB
  maxLogBufferLines: 10000,
} as const;