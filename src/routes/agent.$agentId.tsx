import { createFileRoute } from "@tanstack/react-router";
import { AgentDetail } from "@/components/agent/AgentDetail";

export const Route = createFileRoute("/agent/$agentId")({
  component: function AgentDetailPage() {
    const { agentId } = Route.useParams();
    return <AgentDetail agentId={agentId} />;
  },
});