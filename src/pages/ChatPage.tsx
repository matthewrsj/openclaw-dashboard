import { useEffect } from "react";
import { useChatStore } from "@/stores/chat";
import { useAgentStore } from "@/stores/agents";
import { AgentSwitcher } from "@/components/chat/AgentSwitcher";
import { ChatView } from "@/components/chat/ChatView";
import { EmptyState } from "@/components/ui/EmptyState";

export function ChatPage() {
  const agents = useAgentStore((s) => s.agentList);
  const activeAgentId = useChatStore((s) => s.activeAgentId);
  const setActiveAgentId = useChatStore((s) => s.setActiveAgentId);

  useEffect(() => {
    if (!activeAgentId && agents.length > 0) setActiveAgentId(agents[0].id);
  }, [activeAgentId, agents, setActiveAgentId]);

  return (
    <div className="flex h-full">
      <AgentSwitcher />
      <div className="flex-1">
        {activeAgentId ? (
          <ChatView agentId={activeAgentId} />
        ) : (
          <EmptyState icon="💬" title="Select an agent" description="Choose an agent from the sidebar to start chatting." className="h-full" />
        )}
      </div>
    </div>
  );
}