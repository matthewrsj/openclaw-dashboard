import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAgentStore } from "@/stores/agents";
import { useChatStore } from "@/stores/chat";
import { StatusDot } from "@/components/ui/StatusDot";
import { Input } from "@/components/ui/Input";

/** Sidebar panel for switching between agent chats. */
export function AgentSwitcher() {
  const agents = useAgentStore((s) => s.agentList);
  const activeAgentId = useChatStore((s) => s.activeAgentId);
  const setActiveAgentId = useChatStore((s) => s.setActiveAgentId);
  const [filter, setFilter] = useState("");

  const filtered = agents.filter((a) =>
    a.name.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className="flex h-full w-56 flex-col border-r border-border-primary bg-bg-secondary">
      {/* Search */}
      <div className="p-2">
        <Input
          placeholder="Search agents…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {/* Agent list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.map((agent) => (
          <button
            key={agent.id}
            onClick={() => setActiveAgentId(agent.id)}
            className={cn(
              "flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors",
              activeAgentId === agent.id
                ? "bg-bg-active text-text-primary"
                : "text-text-secondary hover:bg-bg-hover",
            )}
          >
            <span className="inline-flex w-6 justify-center text-base">{agent.emoji}</span>
            <span className="flex-1 truncate text-left">{agent.name}</span>
            <StatusDot
              status={agent.status === "active" ? "success" : "inactive"}
              size="sm"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
