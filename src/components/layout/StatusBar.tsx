import { cn } from "@/lib/utils";
import { useGatewayStore } from "@/stores/gateway";
import { StatusDot } from "@/components/ui/StatusDot";

const STATUS_LABELS: Record<string, string> = {
  connected: "Connected",
  connecting: "Connecting…",
  reconnecting: "Reconnecting…",
  disconnected: "Disconnected",
};

/** Bottom status bar showing gateway connection and global metrics. */
export function StatusBar() {
  const connectionState = useGatewayStore((s) => s.connectionState);
  const version = useGatewayStore((s) => s.version);
  const reconnectAttempt = useGatewayStore((s) => s.reconnectAttempt);

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
      {/* Left: connection status */}
      <div className="flex items-center gap-2">
        <StatusDot status={dotStatus} size="sm" />
        <span>
          {STATUS_LABELS[connectionState]}
          {connectionState === "reconnecting" &&
            ` (attempt ${reconnectAttempt})`}
        </span>
        {version && connectionState === "connected" && (
          <span className="text-text-tertiary">v{version}</span>
        )}
      </div>

      {/* Right: placeholder for global burn rate */}
      <div className="flex items-center gap-3">
        <span className={cn(
          "tabular-nums",
          connectionState !== "connected" && "text-text-tertiary",
        )}>
          Gateway {connectionState === "connected" ? "●" : "○"}
        </span>
      </div>
    </footer>
  );
}
