import { Link, useNavigate } from "@tanstack/react-router";
import { useChatStore } from "@/stores/chat";
import { StatusDot } from "@/components/ui/StatusDot";
import { cn } from "@/lib/utils";
import type { Agent } from "@/types/agent";

const TABS = [
  { id: "chat", label: "Chat" },
  { id: "overview", label: "Overview" },
  { id: "sessions", label: "Sessions" },
  { id: "memory", label: "Memory" },
  { id: "logs", label: "Logs" },
  { id: "settings", label: "Settings" },
] as const;

export type AgentTab = (typeof TABS)[number]["id"];

interface AgentHeaderProps {
  agent: Agent;
  activeTab: AgentTab;
}

export function AgentHeader({
  agent,
  activeTab,
}: AgentHeaderProps) {
  const navigate = useNavigate();
  const setActiveAgentId = useChatStore(
    (s) => s.setActiveAgentId,
  );

  const statusVariant =
    agent.status === "active"
      ? "success"
      : agent.status === "error"
        ? "error"
        : "inactive";

  const handleTabClick = (tabId: AgentTab) => {
    if (tabId === "chat") {
      setActiveAgentId(agent.id);
      navigate({ to: "/chat" });
    }
  };

  return (
    <div
      className={
        "flex items-center gap-3 border-b"
        + " border-border-primary px-4 py-2"
      }
    >
      <span className="text-base">{agent.emoji}</span>
      <span className="text-sm font-medium text-text-primary">
        {agent.name}
      </span>
      <StatusDot
        status={statusVariant}
        size="sm"
        pulse={agent.status === "active"}
      />
      <span className="font-mono text-xs text-text-tertiary">
        {agent.model}
      </span>

      <div className="ml-auto flex items-center">
        {TABS.map((tab) =>
          tab.id === "chat" ? (
            <button
              key={tab.id}
              onClick={() => handleTabClick("chat")}
              className={cn(
                "border-b-2 px-3 py-1.5 text-xs font-medium",
                "transition-colors",
                activeTab === "chat"
                  ? "border-accent-primary text-text-primary"
                  : "border-transparent text-text-tertiary"
                    + " hover:text-text-primary",
              )}
            >
              Chat
            </button>
          ) : (
            <Link
              key={tab.id}
              to="/agent/$agentId"
              params={{ agentId: agent.id }}
              search={{ tab: tab.id }}
              className={cn(
                "border-b-2 px-3 py-1.5 text-xs font-medium",
                "transition-colors",
                activeTab === tab.id
                  ? "border-accent-primary text-text-primary"
                  : "border-transparent text-text-tertiary"
                    + " hover:text-text-primary",
              )}
            >
              {tab.label}
            </Link>
          ),
        )}
      </div>
    </div>
  );
}
