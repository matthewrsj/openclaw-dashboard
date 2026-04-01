import { useAgentStore } from "@/stores/agents";
import { AgentCard } from "./AgentCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";

export function AgentCardGrid() {
  const loading = useAgentStore((s) => s.loading);
  const agentList = useAgentStore((s) => s.agentList);

  if (loading) {
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    );
  }

  if (agentList.length === 0) {
    return (
      <EmptyState
        title="No agents found"
        description="Get started by connecting to a Gateway or creating your first agent."
        action={
          <Button 
            variant="primary"
            onClick={() => console.info("Create agent clicked")}
          >
            Create Agent
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {agentList.map((agent) => (
        <AgentCard key={agent.id} agent={agent} />
      ))}
    </div>
  );
}