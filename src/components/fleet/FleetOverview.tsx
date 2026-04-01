import { useEffect } from "react";
import { useAgentStore } from "@/stores/agents";
import { useSessionStore } from "@/stores/sessions";
import { useUIStore } from "@/stores/ui";
import { AgentCard } from "./AgentCard";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCost } from "@/lib/format";

export function FleetOverview() {
  const agents = useAgentStore((s) => s.getAgentList());
  const loading = useAgentStore((s) => s.loading);
  const error = useAgentStore((s) => s.error);
  const fetchAgents = useAgentStore((s) => s.fetchAgents);
  const fetchSessions = useSessionStore((s) => s.fetchSessions);
  const openModal = useUIStore((s) => s.openModal);

  useEffect(() => { fetchAgents(); fetchSessions(); }, [fetchAgents, fetchSessions]);

  const activeCount = agents.filter((a) => a.status === "active").length;
  const totalCost = agents.reduce((sum, a) => sum + a.costToday, 0);

  if (error) {
    return <EmptyState icon="⚠️" title="Failed to load agents" description={error} action={{ label: "Retry", onClick: fetchAgents }} />;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-text-primary">Fleet Overview</h1>
        <Button onClick={() => openModal({ type: "create-agent" })} size="sm">+ New Agent</Button>
      </div>
      <div className="flex items-center gap-6 mb-6 text-sm text-text-secondary">
        <span>{agents.length} agent{agents.length !== 1 ? "s" : ""}</span>
        <span>{activeCount} active</span>
        <span>{formatCost(totalCost)} today</span>
      </div>
      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-48 rounded-lg" />)}
        </div>
      ) : agents.length === 0 ? (
        <EmptyState icon="🤖" title="No agents yet" description="Create your first agent to get started." action={{ label: "Create Agent", onClick: () => openModal({ type: "create-agent" }) }} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {agents.map((agent) => <AgentCard key={agent.id} agent={agent} />)}
        </div>
      )}
    </div>
  );
}