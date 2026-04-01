import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { useSettingsStore } from "@/stores/settings";

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
  draft?: string;
  onDraftChange?: (text: string) => void;
}

/** Chat message input with send button. */
export function ChatInput({
  onSend,
  disabled = false,
  draft = "",
  onDraftChange,
}: ChatInputProps) {
  const [value, setValue] = useState(draft);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const enterToSend = useSettingsStore((s) => s.enterToSend);

  const handleChange = (text: string) => {
    setValue(text);
    onDraftChange?.(text);
  };

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    onDraftChange?.("");
    // Refocus textarea
    textareaRef.current?.focus();
  }, [value, disabled, onSend, onDraftChange]);

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

  return (
    <div className="flex items-end gap-2 border-t border-border-primary bg-bg-primary p-4">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message…"
        disabled={disabled}
        rows={1}
        className="min-h-[36px] max-h-[200px] flex-1 resize-none rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--input-focus-ring)] disabled:opacity-50"
      />
      <Button
        onClick={handleSend}
        disabled={!value.trim() || disabled}
        size="md"
      >
        Send
      </Button>
    </div>
  );
}
