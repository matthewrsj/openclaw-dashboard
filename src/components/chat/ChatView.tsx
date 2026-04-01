import { useEffect, useRef } from "react";
import { useChatStore } from "@/stores/chat";
import { useAgentStore } from "@/stores/agents";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { uniqueId } from "@/lib/utils";

interface ChatViewProps {
  agentId: string;
}

/** Full chat interface for a single agent. */
export function ChatView({ agentId }: ChatViewProps) {
  const agent = useAgentStore((s) => s.agents.get(agentId));
  const sessionKey = agent?.activeSessionKey || `agent:${agentId}:main`;
  const messages = useChatStore((s) => s.messages.get(sessionKey) || []);
  const isStreaming = useChatStore((s) => s.streamingState.get(sessionKey)?.isStreaming || false);
  const addMessage = useChatStore((s) => s.addMessage);
  const draft = useChatStore((s) => s.drafts.get(agentId) || "");
  const setDraft = useChatStore((s) => s.setDraft);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSend = (content: string) => {
    // Add user message immediately (optimistic)
    addMessage(sessionKey, {
      id: uniqueId("msg-"),
      sessionKey,
      role: "user",
      content,
      timestamp: Date.now(),
      status: "sent",
    });

    // TODO: Wire to streaming chat API via gateway-http service
    // For now, add a placeholder assistant response
    const assistantId = uniqueId("msg-");
    addMessage(sessionKey, {
      id: assistantId,
      sessionKey,
      role: "assistant",
      content: "",
      timestamp: Date.now(),
      status: "streaming",
    });
  };

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto" role="log">
        {messages.length === 0 ? (
          <EmptyState
            icon={agent?.emoji || "💬"}
            title={`Start a conversation with ${agent?.name || "this agent"}`}
            description="Type a message below to begin."
            className="h-full"
          />
        ) : (
          <div className="py-4">
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                agentEmoji={agent?.emoji}
              />
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        disabled={isStreaming}
        draft={draft}
        onDraftChange={(text) => setDraft(agentId, text)}
      />
    </div>
  );
}
