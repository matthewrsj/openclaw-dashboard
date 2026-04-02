import { useEffect, useRef, useCallback, useMemo } from "react";
import { useChatStore } from "@/stores/chat";
import { useAgentStore } from "@/stores/agents";
import { useSettingsStore } from "@/stores/settings";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { uniqueId } from "@/lib/utils";
import { getHttpClient } from "@/services/gateway-http";
import { getToken } from "@/services/tauri-commands";
import type { ChatCompletionRequest } from "@/types/chat";

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
  const gatewayUrl = useSettingsStore((s) => s.gatewayUrl);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

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

    // Stream the response from the Gateway HTTP API
    const abortController = new AbortController();
    setStreamingState(sessionKey, {
      isStreaming: true,
      abortController,
      partialContent: "",
    });

    let accumulated = "";
    try {
      const token = await getToken() || "";
      const client = getHttpClient(gatewayUrl, token);

      // Build the messages array from session history
      const currentMessages = useChatStore.getState().messages.get(sessionKey) || [];
      const apiMessages = currentMessages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .filter((m) => m.id !== assistantId) // exclude the empty placeholder
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

      const request: ChatCompletionRequest = {
        model: "default",
        messages: apiMessages,
        stream: true,
        agent_id: agentId,
        session_key: sessionKey,
      };

      for await (const chunk of client.streamChatCompletion(request, abortController.signal)) {
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) {
          accumulated += delta;
          updateMessage(sessionKey, assistantId, { content: accumulated });
          setStreamingState(sessionKey, { partialContent: accumulated });
        }

        if (chunk.choices?.[0]?.finish_reason) {
          break;
        }
      }

      updateMessage(sessionKey, assistantId, { status: "sent", content: accumulated });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (abortController.signal.aborted) {
        updateMessage(sessionKey, assistantId, { status: "sent" });
      } else {
        updateMessage(sessionKey, assistantId, {
          status: "error",
          error: errorMsg,
          content: accumulated || "",
        });
      }
    } finally {
      setStreamingState(sessionKey, {
        isStreaming: false,
        abortController: null,
        partialContent: "",
      });
    }
  }, [sessionKey, agentId, gatewayUrl, addMessage, updateMessage, setStreamingState]);

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
