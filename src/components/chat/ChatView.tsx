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
  const loadHistory = useChatStore((s) => s.loadHistory);
  const draft = useChatStore((s) => s.drafts.get(agentId) || "");
  const setDraft = useChatStore((s) => s.setDraft);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load chat history and subscribe to live messages on mount / session change
  useEffect(() => {
    loadHistory(sessionKey);
    // Subscribe to live session messages (from other clients/channels)
    gatewayRpc("sessions.messages.subscribe", { key: sessionKey }).catch(
      (err) => console.warn("Failed to subscribe to session messages:", err),
    );
    return () => {
      gatewayRpc("sessions.messages.unsubscribe", { key: sessionKey }).catch(() => {});
    };
  }, [sessionKey, loadHistory]);

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

    // Register the pending run BEFORE sending the RPC.
    // The idempotencyKey becomes the runId, and chat push events
    // can arrive before the RPC response resolves.
    useChatStore.getState().registerPendingRun(assistantId, sessionKey, assistantId);

    try {
      // Send via Gateway WebSocket RPC
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
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      updateMessage(sessionKey, assistantId, {
        status: "error",
        error: errorMsg,
        content: "",
      });
      useChatStore.getState().cleanupPendingRun(assistantId, sessionKey);
    }
  }, [sessionKey, agentId, addMessage, updateMessage, setStreamingState]);

  const handleStop = useCallback(async () => {
    try {
      await gatewayRpc("chat.abort", { sessionKey });
    } catch (err) {
      console.warn("Failed to abort:", err);
    }
  }, [sessionKey]);

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
                agentName={agent?.name}
              />
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        onStop={handleStop}
        isStreaming={isStreaming}
        sessionKey={sessionKey}
        draft={draft}
        onDraftChange={(text) => setDraft(agentId, text)}
      />
    </div>
  );
}
