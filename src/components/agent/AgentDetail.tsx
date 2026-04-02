import { useState, useEffect } from "react";
import { useAgentStore } from "@/stores/agents";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { StatusDot } from "@/components/ui/StatusDot";
import { EmptyState } from "@/components/ui/EmptyState";
import { AgentOverview } from "./AgentOverview";
import { AgentSettings } from "./AgentSettings";
import { SubagentList } from "./SubagentList";
import { MemoryViewer } from "@/components/memory/MemoryViewer";
import { LogTail } from "@/components/logs/LogTail";
import { useNavigate } from "@tanstack/react-router";
import { useChatStore } from "@/stores/chat";

interface AgentDetailProps { agentId: string; }

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "sessions", label: "Sessions" },
  { id: "memory", label: "Memory" },
  { id: "logs", label: "Logs" },
  { id: "settings", label: "Settings" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function AgentDetail({ agentId }: AgentDetailProps) {
  const agent = useAgentStore((s) => s.agents.get(agentId));
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const navigate = useNavigate();
  const setActiveAgentId = useChatStore((s) => s.setActiveAgentId);

  useEffect(() => { setActiveTab("overview"); }, [agentId]);

  if (!agent) {
    return <EmptyState icon="❓" title="Agent not found" description={`No agent with ID "${agentId}" exists.`} action={{ label: "Back to Fleet", onClick: () => navigate({ to: "/" }) }} />;
  }

  const statusVariant = agent.status === "active" ? "success" : agent.status === "error" ? "error" : "inactive";

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border-primary px-6 py-3">
        <button onClick={() => navigate({ to: "/" })} className="text-sm text-text-secondary hover:text-text-primary">← Fleet</button>
        <span className="text-xl">{agent.emoji}</span>
        <h1 className="text-base font-semibold text-text-primary">{agent.name}</h1>
        <StatusDot status={statusVariant} size="sm" pulse={agent.status === "active"} />
        <Badge variant={statusVariant === "success" ? "success" : statusVariant === "error" ? "error" : "secondary"}>{agent.status}</Badge>
        <span className="font-mono text-xs text-text-tertiary">{agent.model}</span>
        <div className="ml-auto">
          <button
            onClick={() => {
              setActiveAgentId(agent.id);
              navigate({ to: "/chat" });
            }}
            className="flex items-center gap-1.5 rounded-md bg-accent-primary/10 px-3 py-1.5 text-xs font-medium text-accent-primary hover:bg-accent-primary/20 transition-colors"
          >
            💬 Chat
          </button>
        </div>
      </div>
      <div className="flex border-b border-border-primary px-6" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id} role="tab" aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn("border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === tab.id ? "border-accent-primary text-text-primary" : "border-transparent text-text-secondary hover:text-text-primary")}
          >{tab.label}</button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto" role="tabpanel">
        {activeTab === "overview" && <AgentOverview agent={agent} />}
        {activeTab === "sessions" && <SubagentList agent={agent} />}
        {activeTab === "memory" && <MemoryViewer agentId={agent.id} />}
        {activeTab === "logs" && <LogTail agentId={agent.id} />}
        {activeTab === "settings" && <AgentSettings agent={agent} />}
      </div>
    </div>
  );
}
