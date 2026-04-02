import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useSettingsStore } from "@/stores/settings";

interface ChatInputProps {
  onSend: (content: string) => void;
  onStop?: () => void;
  isStreaming?: boolean;
  draft?: string;
  onDraftChange?: (text: string) => void;
}

/** Chat message input with auto-grow, always-active typing, and message queueing. */
export function ChatInput({
  onSend,
  onStop,
  isStreaming = false,
  draft = "",
  onDraftChange,
}: ChatInputProps) {
  const [value, setValue] = useState(draft);
  const [queue, setQueue] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const enterToSend = useSettingsStore((s) => s.enterToSend);

  // Auto-resize textarea to fit content
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    // Clamp between 1 line (~36px) and ~8 lines (~200px)
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
      // Combine queued messages and send as one
      const combined = queue.join("\n\n");
      setQueue([]);
      onSend(combined);
    }
  }, [isStreaming, queue, onSend]);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;

    if (isStreaming) {
      // Queue the message for when the agent is done
      setQueue((q) => [...q, trimmed]);
      setValue("");
      onDraftChange?.("");
      textareaRef.current?.focus();
    } else {
      onSend(trimmed);
      setValue("");
      onDraftChange?.("");
      textareaRef.current?.focus();
    }
  }, [value, isStreaming, onSend, onDraftChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Cmd/Ctrl+Enter always sends
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
      return;
    }
    // Enter to send (configurable)
    if (e.key === "Enter" && !e.shiftKey && enterToSend) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  return (
    <div className="border-t border-border-primary bg-bg-primary">
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
              onClick={clearQueue}
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
                  onClick={() => setQueue((q) => q.filter((_, idx) => idx !== i))}
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
          <Button
            onClick={onStop}
            variant="danger"
            size="md"
          >
            ■ Stop
          </Button>
        )}
        <Button
          onClick={handleSend}
          disabled={!value.trim()}
          size="md"
        >
          {isStreaming && value.trim() ? "Queue" : "Send"}
        </Button>
      </div>
    </div>
  );
}
