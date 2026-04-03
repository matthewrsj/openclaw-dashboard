import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { filterCommands } from "@/services/slash-commands";
import type { SlashCommand } from "@/services/slash-commands";
import { cn } from "@/lib/utils";

interface SlashCommandMenuProps {
  /** Current input value from the textarea. */
  inputValue: string;
  /** Called when the user selects a command from the menu. */
  onSelect: (commandName: string) => void;
  /** Called when the menu is dismissed via Escape. */
  onDismiss: () => void;
  /** Whether the menu is visible. */
  visible: boolean;
}

/**
 * Autocomplete dropdown for slash commands.
 *
 * Appears above the chat input when the user types `/` at the start
 * of their message. Filters commands as the user types, supports
 * arrow-key navigation and Enter to select.
 */
export function SlashCommandMenu({
  inputValue,
  onSelect,
  onDismiss,
  visible,
}: SlashCommandMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Extract the partial command name (everything after the leading `/`)
  const prefix = inputValue.startsWith("/")
    ? inputValue.slice(1).split(" ")[0]
    : "";
  const hasSpace = inputValue.includes(" ");

  // Only show when visible, input starts with `/`, and no space yet
  // (once the user types a space they are entering args, not searching)
  const matches = useMemo(
    () => (visible && !hasSpace ? filterCommands(prefix) : []),
    [visible, hasSpace, prefix],
  );

  // Reset selection when matches change
  useEffect(() => {
    setSelectedIndex(0);
  }, [prefix]);

  // Scroll the selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll("[data-index]");
    items[selectedIndex]?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (matches.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % matches.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + matches.length) % matches.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        onSelect(matches[selectedIndex].name);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onDismiss();
      }
    },
    [matches, selectedIndex, onSelect, onDismiss],
  );

  useEffect(() => {
    if (matches.length === 0) return;
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [matches.length, handleKeyDown]);

  if (matches.length === 0) return null;

  return (
    <div
      ref={listRef}
      className={cn(
        "absolute bottom-full left-0 right-0 mb-1 z-50",
        "max-h-[240px] overflow-y-auto rounded-md border",
        "border-border-primary bg-bg-secondary shadow-lg",
      )}
      role="listbox"
    >
      {matches.map((cmd: SlashCommand, i: number) => (
        <div
          key={cmd.name}
          data-index={i}
          role="option"
          aria-selected={i === selectedIndex}
          className={cn(
            "flex cursor-pointer items-center gap-3 px-3 py-2",
            i === selectedIndex && "bg-bg-hover",
          )}
          onMouseEnter={() => setSelectedIndex(i)}
          onMouseDown={(e) => {
            e.preventDefault(); // keep textarea focus
            onSelect(cmd.name);
          }}
        >
          <span className="font-medium text-sm text-text-primary">
            /{cmd.name}
          </span>
          <span className="text-xs text-text-tertiary truncate">
            {cmd.description}
          </span>
        </div>
      ))}
    </div>
  );
}
