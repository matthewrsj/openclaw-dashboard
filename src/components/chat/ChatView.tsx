import { useEffect, useRef, useCallback, useMemo } from "react";
import { useChatStore } from "@/stores/chat";
import { useAgentStore } from "@/stores/agents";
import { AgentHeader } from "@/components/agent/AgentHeader";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { uniqueId } from "@/lib/utils";
import { gatewayRpc } from "@/services/tauri-commands";
import { useUIStore } from "@/stores/ui";
import { useNavigate } from "@tanstack/react-router";
import {
  findCommand,
  parseArgs,
  type SlashCommandContext,
} from "@/services/slash-commands";

interface ChatViewProps {
  agentId: string;
}

/** Full chat interface for a single agent. */
export function ChatView({ agentId }: ChatViewProps) {
  const agent = useAgentStore((s) => s.agents.get(agentId));
  const sessionKey = agent?.activeSessionKey || `agent:${agentId}:main`;
  const messagesRaw = useChatStore((s) => s.messages.get(sessionKey));
  const messages = useMemo(() => messagesRaw ?? [], [messagesRaw]);
  const streamingStateForSession = useChatStore((s) => s.streamingState.get(sessionKey));
  const isStreaming = streamingStateForSession?.isStreaming ?? false;
  const streamingStartedAt = streamingStateForSession?.startedAt ?? null;
  const addMessage = useChatStore((s) => s.addMessage);
  const updateMessage = useChatStore((s) => s.updateMessage);
  const setStreamingState = useChatStore((s) => s.setStreamingState);
  const loadHistory = useChatStore((s) => s.loadHistory);
  const clearMessages = useChatStore((s) => s.clearMessages);
  const draft = useChatStore((s) => s.drafts.get(agentId) || "");
  const setDraft = useChatStore((s) => s.setDraft);
  const addToast = useUIStore((s) => s.addToast);
  const navigate = useNavigate();
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

  // Build the slash command context once so it is stable across renders
  const slashContext: SlashCommandContext = useMemo(
    () => ({
      agentId,
      sessionKey,
      addToast: (t) => addToast({ type: t.type as "info", message: t.message }),
      navigate: (opts) => navigate(opts),
    }),
    [agentId, sessionKey, addToast, navigate],
  );

  const handleSend = useCallback(async (content: string) => {
    // --- Slash command interception ---
    if (content.startsWith("/")) {
      const withoutSlash = content.slice(1);
      const parts = parseArgs(withoutSlash);
      const commandName = parts[0]?.toLowerCase();
      const commandArgs = parts.slice(1);

      if (!commandName) return;

      const command = findCommand(commandName);
      if (!command) {
        addMessage(sessionKey, {
          id: uniqueId("sys-"),
          sessionKey,
          role: "system",
          content: `Unknown command **/${commandName}**. `
            + "Type **/help** to see available commands.",
          timestamp: Date.now(),
          status: "sent",
        });
        return;
      }

      try {
        const result = await command.execute(commandArgs, slashContext);

        // Special handling for /clear
        if (result === "__CLEAR__") {
          clearMessages(sessionKey);
          return;
        }

        if (result) {
          addMessage(sessionKey, {
            id: uniqueId("sys-"),
            sessionKey,
            role: "system",
            content: result,
            timestamp: Date.now(),
            status: "sent",
          });
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        addMessage(sessionKey, {
          id: uniqueId("sys-"),
          sessionKey,
          role: "system",
          content: `Command **/${commandName}** failed: ${errorMsg}`,
          timestamp: Date.now(),
          status: "error",
          error: errorMsg,
        });
      }
      return;
    }

    // --- Normal message send ---

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
      startedAt: Date.now(),
    });

    // Register the pending run BEFORE sending the RPC.
    // The idempotencyKey becomes the runId, and chat push events
    // can arrive before the RPC response resolves.
    useChatStore.getState().registerPendingRun(
      assistantId, sessionKey, assistantId,
    );

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

      // If the gateway assigned a different runId, register
      // it so push events are correctly correlated.
      if (result.runId && result.runId !== assistantId) {
        useChatStore.getState().registerPendingRun(
          result.runId,
          sessionKey,
          assistantId,
        );
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
  }, [
    sessionKey, addMessage, updateMessage, setStreamingState,
    clearMessages, slashContext,
  ]);

  const handleStop = useCallback(async () => {
    try {
      await gatewayRpc("chat.abort", { sessionKey });
    } catch (err) {
      console.warn("Failed to abort:", err);
    }
  }, [sessionKey]);

  return (
    <div className="flex h-full flex-col">
      {agent && (
        <AgentHeader agent={agent} activeTab="chat" />
      )}

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
        streamingStartedAt={streamingStartedAt}
        sessionKey={sessionKey}
        draft={draft}
        onDraftChange={(text) => setDraft(agentId, text)}
      />
    </div>
  );
}
