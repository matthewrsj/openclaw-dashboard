import { createFileRoute } from "@tanstack/react-router";
import { AgentDetail } from "@/components/agent/AgentDetail";

export const Route = createFileRoute("/agent/$agentId")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { tab?: string } => ({
    tab: typeof search.tab === "string"
      ? search.tab
      : undefined,
  }),
  component: function AgentDetailPage() {
    const { agentId } = Route.useParams();
    const { tab } = Route.useSearch();
    return <AgentDetail agentId={agentId} initialTab={tab} />;
  },
});
