import { useEffect, useRef, useCallback, useMemo } from "react";
import { useChatStore } from "@/stores/chat";
import { useAgentStore } from "@/stores/agents";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { uniqueId } from "@/lib/utils";
import { gatewayRpc } from "@/services/tauri-commands";

interface ChatViewProps {
  agentId: string;
}

/** Full chat interface for a single agent. */
export function ChatView({ agentId }: ChatViewProps) {
  const agent = useAgentStore((s) => s.agents.get(agentId));
  const sessionKey = agent?.activeSessionKey || `agent:${agentId}:main`;
  const messagesRaw = useChatStore((s) => s.messages.get(sessionKey));
  const messages = useMemo(() => messagesRaw ?? [], [messagesRaw]);
  const isStreaming = useChatStore((s) => s.streamingState.get(sessionKey)?.isStreaming ?? false);
  const addMessage = useChatStore((s) => s.addMessage);
  const updateMessage = useChatStore((s) => s.updateMessage);
  const setStreamingState = useChatStore((s) => s.setStreamingState);
  const draft = useChatStore((s) => s.drafts.get(agentId) || "");
  const setDraft = useChatStore((s) => s.setDraft);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages or content changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = useCallback(async (content: string) => {
    // Add user message immediately (optimistic)
    addMessage(sessionKey, {
      id: uniqueId("msg-"),
      sessionKey,
      role: "user",
      content,
      timestamp: Date.now(),
      status: "sent",
    });

    // Add placeholder assistant message for streaming
    const assistantId = uniqueId("msg-");
    addMessage(sessionKey, {
      id: assistantId,
      sessionKey,
      role: "assistant",
      content: "",
      timestamp: Date.now(),
      status: "streaming",
    });

    setStreamingState(sessionKey, {
      isStreaming: true,
      abortController: null,
      partialContent: "",
    });

    try {
      // Send via Gateway WebSocket RPC
      // idempotencyKey becomes the runId for correlating chat events
      const result = await gatewayRpc<{
        ok?: boolean;
        runId?: string;
        status?: string;
        error?: string;
      }>(
        "chat.send",
        {
          sessionKey,
          message: content,
          idempotencyKey: assistantId,
        },
      );

      if (result === null) {
        throw new Error("Gateway not connected");
      }

      if (result.error) {
        throw new Error(result.error);
      }

      // Register the run for event correlation.
      // runId = idempotencyKey = assistantId
      const runId = result.runId || assistantId;
      useChatStore.getState().registerPendingRun(runId, sessionKey, assistantId);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      updateMessage(sessionKey, assistantId, {
        status: "error",
        error: errorMsg,
        content: "",
      });
      setStreamingState(sessionKey, {
        isStreaming: false,
        abortController: null,
        partialContent: "",
      });
    }
  }, [sessionKey, agentId, addMessage, updateMessage, setStreamingState]);

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
