import { Link } from "@tanstack/react-router";
import { useAgentStore } from "@/stores/agents";
import { StatusDot } from "@/components/ui/StatusDot";

export function SidebarAgents() {
  const agents = useAgentStore((state) => state.getAgentList());

  if (agents.length === 0) {
    return (
      <div className="border-t border-sidebar-border p-4">
        <h3 className="mb-2 text-xs font-medium text-text-tertiary uppercase">
          Agents
        </h3>
        <p className="text-xs text-text-tertiary">No agents available</p>
      </div>
    );
  }

  return (
    <div className="border-t border-sidebar-border">
      <div className="p-4">
        <h3 className="mb-2 text-xs font-medium text-text-tertiary uppercase">
          Agents
        </h3>
        <ul className="space-y-1">
          {agents.slice(0, 6).map((agent) => (
            <li key={agent.id}>
              <Link
                to="/agent/$agentId"
                params={{ agentId: agent.id }}
                className="flex items-center rounded-md p-2 text-sm hover:bg-bg-hover"
              >
                <span className="mr-2 text-base">{agent.emoji}</span>
                <span className="min-w-0 flex-1 truncate text-text-secondary">
                  {agent.name}
                </span>
                <StatusDot
                  status={
                    agent.status === "active"
                      ? "success"
                      : agent.status === "error"
                        ? "error"
                        : "inactive"
                  }
                  size="sm"
                  pulse={agent.status === "active"}
                />
              </Link>
            </li>
          ))}
        </ul>
        {agents.length > 6 && (
          <Link
            to="/"
            className="mt-2 block text-xs text-text-tertiary hover:text-text-primary"
          >
            +{agents.length - 6} more agents
          </Link>
        )}
      </div>
    </div>
  );
}