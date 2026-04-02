import { useState, useRef, useCallback, useEffect, useMemo } from "react";

/** Hook that returns elapsed seconds since `active` became true. Resets on false. */
function useElapsedTimer(active: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);

  useEffect(() => {
    if (!active) {
      setElapsed(0);
      return;
    }
    startRef.current = Date.now();
    setElapsed(0);
    const interval = setInterval(() => {
      setElapsed(Date.now() - startRef.current);
    }, 1000);
    return () => clearInterval(interval);
  }, [active]);

  return elapsed;
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useSettingsStore } from "@/stores/settings";
import { useChatStore } from "@/stores/chat";

interface ChatInputProps {
  onSend: (content: string) => void;
  onStop?: () => void;
  isStreaming?: boolean;
  sessionKey: string;
  draft?: string;
  onDraftChange?: (text: string) => void;
}

/** Chat message input with auto-grow, always-active typing, and per-session message queueing. */
export function ChatInput({
  onSend,
  onStop,
  isStreaming = false,
  sessionKey,
  draft = "",
  onDraftChange,
}: ChatInputProps) {
  const [value, setValue] = useState(draft);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const enterToSend = useSettingsStore((s) => s.enterToSend);
  const streamingElapsed = useElapsedTimer(isStreaming);

  // Per-session queue from store
  const queueRaw = useChatStore((s) => s.messageQueues.get(sessionKey));
  const queue = useMemo(() => queueRaw ?? [], [queueRaw]);
  const enqueueMessage = useChatStore((s) => s.enqueueMessage);
  const dequeueMessage = useChatStore((s) => s.dequeueMessage);
  const clearQueue = useChatStore((s) => s.clearQueue);
  const flushQueue = useChatStore((s) => s.flushQueue);

  // Auto-resize textarea to fit content
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  useEffect(() => {
    autoResize();
  }, [value, autoResize]);

  const handleChange = (text: string) => {
    setValue(text);
    onDraftChange?.(text);
  };

  // Flush queue when streaming ends
  useEffect(() => {
    if (!isStreaming && queue.length > 0) {
      const combined = flushQueue(sessionKey);
      if (combined) onSend(combined);
    }
  }, [isStreaming, queue.length, sessionKey, flushQueue, onSend]);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;

    if (isStreaming) {
      enqueueMessage(sessionKey, trimmed);
    } else {
      onSend(trimmed);
    }
    setValue("");
    onDraftChange?.("");
    textareaRef.current?.focus();
  }, [value, isStreaming, sessionKey, onSend, onDraftChange, enqueueMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey && enterToSend) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-border-primary bg-bg-primary">
      {/* Streaming indicator with timer */}
      {isStreaming && (
        <div className="flex items-center gap-2 px-4 pt-2 text-xs text-accent-primary">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-primary animate-pulse" />
          <span>Streaming</span>
          <span className="tabular-nums text-text-tertiary">{formatDuration(streamingElapsed)}</span>
        </div>
      )}

      {/* Queue preview */}
      {queue.length > 0 && (
        <div className="px-4 pt-3">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <Badge variant="default">
                {queue.length} queued
              </Badge>
              <span className="text-xs text-text-tertiary">
                Will send when {isStreaming ? "agent finishes" : "ready"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => clearQueue(sessionKey)}
              className="text-xs text-text-tertiary hover:text-text-secondary"
            >
              ✕ Clear
            </button>
          </div>
          <div className="space-y-1 max-h-[120px] overflow-y-auto">
            {queue.map((msg, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-md bg-accent-primary/8 px-3 py-1.5 text-xs text-text-secondary"
              >
                <span className="shrink-0 text-text-tertiary">{i + 1}.</span>
                <span className="line-clamp-2">{msg}</span>
                <button
                  type="button"
                  onClick={() => dequeueMessage(sessionKey, i)}
                  className="shrink-0 text-text-tertiary hover:text-text-secondary ml-auto"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-end gap-2 p-4">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isStreaming ? "Type ahead — will queue…" : "Type a message…"}
          rows={1}
          className="min-h-[36px] max-h-[200px] flex-1 resize-none rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--input-focus-ring)]"
        />
        {isStreaming && onStop && (
          <Button onClick={onStop} variant="danger" size="md">
            ■ Stop
          </Button>
        )}
        <Button onClick={handleSend} disabled={!value.trim()} size="md">
          {isStreaming && value.trim() ? "Queue" : "Send"}
        </Button>
      </div>
    </div>
  );
}
