import { useState, useEffect } from "react";
import { useAgentStore } from "@/stores/agents";
import { EmptyState } from "@/components/ui/EmptyState";
import { AgentOverview } from "./AgentOverview";
import { AgentSettings } from "./AgentSettings";
import { AgentHeader } from "./AgentHeader";
import type { AgentTab } from "./AgentHeader";
import { SubagentList } from "./SubagentList";
import { MemoryViewer } from "@/components/memory/MemoryViewer";
import { LogTail } from "@/components/logs/LogTail";
import { useNavigate } from "@tanstack/react-router";

const DETAIL_TABS: AgentTab[] = [
  "overview",
  "sessions",
  "memory",
  "logs",
  "settings",
];

interface AgentDetailProps {
  agentId: string;
  initialTab?: string;
}

export function AgentDetail({
  agentId,
  initialTab,
}: AgentDetailProps) {
  const agent = useAgentStore((s) => s.agents.get(agentId));
  const validTab = DETAIL_TABS.includes(
    initialTab as AgentTab,
  )
    ? (initialTab as AgentTab)
    : "overview";
  const [activeTab, setActiveTab] =
    useState<AgentTab>(validTab);
  const navigate = useNavigate();

  useEffect(() => {
    const tab = DETAIL_TABS.includes(
      initialTab as AgentTab,
    )
      ? (initialTab as AgentTab)
      : "overview";
    setActiveTab(tab);
  }, [agentId, initialTab]);

  if (!agent) {
    return (
      <EmptyState
        icon="?"
        title="Agent not found"
        description={`No agent with ID "${agentId}" exists.`}
        action={{
          label: "Back to Fleet",
          onClick: () => navigate({ to: "/" }),
        }}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <AgentHeader agent={agent} activeTab={activeTab} />
      <div className="flex-1 overflow-y-auto" role="tabpanel">
        {activeTab === "overview" && (
          <AgentOverview agent={agent} />
        )}
        {activeTab === "sessions" && (
          <SubagentList agent={agent} />
        )}
        {activeTab === "memory" && (
          <MemoryViewer agentId={agent.id} />
        )}
        {activeTab === "logs" && (
          <LogTail agentId={agent.id} />
        )}
        {activeTab === "settings" && (
          <AgentSettings agent={agent} />
        )}
      </div>
    </div>
  );
}
