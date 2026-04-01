import type { Agent } from "@/types/agent";
import { useSessionStore } from "@/stores/sessions";
import { Table } from "@/components/ui/Table";
import { StatusDot } from "@/components/ui/StatusDot";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatRelativeTime, formatTokens, formatCost } from "@/lib/format";
import type { Session } from "@/types/session";

interface SubagentListProps { agent: Agent; }

export function SubagentList({ agent }: SubagentListProps) {
  const sessions = useSessionStore((s) => s.getSessionsForAgent(agent.id));
  if (sessions.length === 0) {
    return <EmptyState icon="📋" title="No sessions yet" description="Start a chat to create a session." />;
  }
  const sorted = [...sessions].sort((a, b) => {
    if (a.status === "active" && b.status !== "active") return -1;
    if (a.status !== "active" && b.status === "active") return 1;
    return b.updatedAt - a.updatedAt;
  });
  const columns = [
    { key: "status", header: "", width: "32px", render: (s: Session) => <StatusDot status={s.status === "active" ? "success" : "inactive"} size="sm" pulse={s.status === "active"} /> },
    { key: "id", header: "Session", sortable: true, render: (s: Session) => <span className="font-mono text-xs">{s.sessionId.slice(0, 8)}</span> },
    { key: "channel", header: "Channel", render: (s: Session) => <span>{s.channel}</span> },
    { key: "created", header: "Created", sortable: true, render: (s: Session) => <span className="text-xs">{formatRelativeTime(s.createdAt)}</span> },
    { key: "messages", header: "Messages", render: (s: Session) => <span>{s.messageCount}</span> },
    { key: "tokens", header: "Tokens", render: (s: Session) => <span className="tabular-nums">{formatTokens(s.tokens.total)}</span> },
    { key: "cost", header: "Cost", render: (s: Session) => <span className="tabular-nums">{formatCost(s.cost)}</span> },
  ];
  return <div className="p-6"><Table columns={columns} data={sorted} keyExtractor={(s) => s.key} emptyMessage="No sessions found" /></div>;
}
