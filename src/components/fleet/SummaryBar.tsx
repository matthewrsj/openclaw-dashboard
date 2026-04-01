import { useAgentStore } from "@/stores/agents";
import { useSessionStore } from "@/stores/sessions";
import { useGatewayStore } from "@/stores/gateway";
import { Card } from "@/components/ui/Card";
import { StatusDot } from "@/components/ui/StatusDot";

export function SummaryBar() {
  const agentCount = useAgentStore((state) => state.getAgentCount());
  const activeAgents = useAgentStore((state) => state.getActiveAgents());
  const sessionCount = useSessionStore((state) => state.getSessionCount());
  const connectionState = useGatewayStore((state) => state.connectionState);

  const summaryItems = [
    {
      label: "Total Agents",
      value: agentCount,
      subtext: `${activeAgents.length} active`,
      status: activeAgents.length > 0 ? "success" : "inactive",
    },
    {
      label: "Active Sessions",
      value: sessionCount,
      subtext: "across all agents",
      status: sessionCount > 0 ? "success" : "inactive",
    },
    {
      label: "Gateway",
      value: connectionState === "connected" ? "Online" : "Offline",
      subtext:
        connectionState === "connected"
          ? "Connected"
          : connectionState === "connecting"
            ? "Connecting..."
            : connectionState === "reconnecting"
              ? "Reconnecting..."
              : "Disconnected",
      status:
        connectionState === "connected"
          ? "success"
          : connectionState === "disconnected"
            ? "error"
            : "warning",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {summaryItems.map((item, index) => (
        <Card key={index} className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-secondary">
                {item.label}
              </p>
              <p className="text-2xl font-bold text-text-primary">
                {item.value}
              </p>
              <p className="text-xs text-text-tertiary">{item.subtext}</p>
            </div>
            <StatusDot
              status={item.status as "success" | "warning" | "error" | "inactive"}
              size="lg"
              pulse={item.status === "warning"}
            />
          </div>
        </Card>
      ))}
    </div>
  );
}