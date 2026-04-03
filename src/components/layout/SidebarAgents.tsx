import { useNavigate } from "@tanstack/react-router";
import { useAgentStore } from "@/stores/agents";
import { useChatStore } from "@/stores/chat";
import { StatusDot } from "@/components/ui/StatusDot";

export function SidebarAgents() {
  const agents = useAgentStore((state) => state.agentList);
  const activeAgentId = useChatStore((s) => s.activeAgentId);
  const setActiveAgentId = useChatStore((s) => s.setActiveAgentId);
  const navigate = useNavigate();

  if (agents.length === 0) {
    return (
      <div className="border-t border-sidebar-border p-4">
        <h3 className="mb-2 text-xs font-medium text-text-tertiary uppercase">
          Agents
        </h3>
        <p className="text-xs text-text-tertiary">
          No agents available
        </p>
      </div>
    );
  }

  const handleClick = (agentId: string) => {
    setActiveAgentId(agentId);
    navigate({ to: "/chat" });
  };

  return (
    <div className="border-t border-sidebar-border">
      <div className="p-4">
        <h3 className="mb-2 text-xs font-medium text-text-tertiary uppercase">
          Agents
        </h3>
        <ul className="space-y-1 overflow-y-auto">
          {agents.map((agent) => (
            <li key={agent.id}>
              <button
                onClick={() => handleClick(agent.id)}
                className={
                  "flex w-full items-center rounded-md p-2"
                  + " text-sm hover:bg-bg-hover"
                  + (activeAgentId === agent.id
                    ? " bg-bg-active text-text-primary"
                    : "")
                }
              >
                <span className="inline-flex w-6 justify-center mr-2 text-base">
                  {agent.emoji}
                </span>
                <span className="min-w-0 flex-1 truncate text-left text-text-secondary">
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
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
