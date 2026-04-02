/**
 * Formatting utilities for dates, numbers, tokens, and durations.
 */

/** Format a Unix timestamp to a relative time string. */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const absDiff = Math.abs(diff);
  const seconds = Math.floor(absDiff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const isFuture = diff < 0;
  const suffix = isFuture ? "" : " ago";
  const prefix = isFuture ? "in " : "";

  if (seconds < 60) return isFuture ? "in <1m" : "just now";
  if (minutes < 60) return `${prefix}${minutes}m${suffix}`;
  if (hours < 24) return `${prefix}${hours}h${isFuture ? ` ${minutes % 60}m` : ""}${suffix}`;
  if (days < 7) return `${prefix}${days}d${suffix}`;
  return new Date(timestamp).toLocaleDateString();
}

/** Format a Unix timestamp to a full date/time string. */
export function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

/** Format a Unix timestamp to just the date. */
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString();
}

/** Format a duration in milliseconds to human-readable string. */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (seconds < 60) return `${seconds}s`;
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  return `${hours}h ${minutes % 60}m`;
}

/** Format a number with thousand separators. */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}

/** Format a token count with K/M suffixes. */
export function formatTokens(tokens: number): string {
  if (tokens < 1000) return tokens.toString();
  if (tokens < 1000000) return `${(tokens / 1000).toFixed(1)}K`;
  return `${(tokens / 1000000).toFixed(1)}M`;
}

/** Format a cost in USD. */
export function formatCost(usd: number): string {
  if (usd === 0) return "$0.00";
  if (usd < 0.01) return `${(usd * 100).toFixed(2)}¢`;
  return `$${usd.toFixed(2)}`;
}

/** Format a percentage with one decimal place. */
export function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

/** Format bytes to human-readable size. */
export function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}