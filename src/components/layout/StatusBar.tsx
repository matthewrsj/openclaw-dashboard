import { useState, useEffect, useRef } from "react";
import { useGatewayStore } from "@/stores/gateway";
import { useChatStore } from "@/stores/chat";
import { StatusDot } from "@/components/ui/StatusDot";

const STATUS_LABELS: Record<string, string> = {
  connected: "Connected",
  connecting: "Connecting…",
  reconnecting: "Reconnecting…",
  disconnected: "Disconnected",
};

/** Format seconds into "Xm Ys" or "Xh Ym" */
function formatUptime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  if (minutes < 60) return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins.toString().padStart(2, "0")}m`;
}

/** Bottom status bar showing connection, streaming state, and session uptime. */
export function StatusBar() {
  const connectionState = useGatewayStore((s) => s.connectionState);
  const version = useGatewayStore((s) => s.version);
  const reconnectAttempt = useGatewayStore((s) => s.reconnectAttempt);

  // Find if any session is currently streaming
  const activeAgentId = useChatStore((s) => s.activeAgentId);
  const streamingState = useChatStore((s) =>
    activeAgentId
      ? s.streamingState.get(
          Array.from(s.streamingState.keys()).find(
            (k) => s.streamingState.get(k)?.isStreaming,
          ) || "",
        )
      : undefined,
  );
  const isStreaming = streamingState?.isStreaming ?? false;

  // Session uptime timer (time since app loaded)
  const startTimeRef = useRef(Date.now());
  const [uptime, setUptime] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setUptime(Date.now() - startTimeRef.current);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const dotStatus =
    connectionState === "connected"
      ? "success"
      : connectionState === "disconnected"
        ? "error"
        : "warning";

  return (
    <footer
      aria-label="Status bar"
      className="flex h-7 items-center justify-between border-t border-border-primary bg-bg-secondary px-4 text-xs text-text-secondary"
    >
      {/* Left: connection + streaming status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <StatusDot status={dotStatus} size="sm" />
          <span>
            {STATUS_LABELS[connectionState]}
            {connectionState === "reconnecting" &&
              ` (attempt ${reconnectAttempt})`}
          </span>
        </div>
        {isStreaming && (
          <span className="flex items-center gap-1.5 text-accent-primary">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-primary animate-pulse" />
            Streaming
          </span>
        )}
      </div>

      {/* Right: uptime + version */}
      <div className="flex items-center gap-3 tabular-nums">
        <span className="text-text-tertiary">
          {formatUptime(uptime)}
        </span>
        {version && connectionState === "connected" && (
          <span className="text-text-tertiary">v{version}</span>
        )}
      </div>
    </footer>
  );
}
