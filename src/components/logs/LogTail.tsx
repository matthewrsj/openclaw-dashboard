import { useState, useEffect, useRef, useCallback } from "react";
import { tailLog, startLogTail, stopLogTail, isTauriAvailable } from "@/services/tauri-commands";
import { listen } from "@tauri-apps/api/event";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

interface LogTailProps {
  agentId: string;
}

const LOG_LEVEL_COLORS: Record<string, string> = {
  DEBUG: "text-text-tertiary",
  INFO: "text-text-primary",
  WARN: "text-status-warning",
  ERROR: "text-status-error",
};

/** Detect log level from a line. */
function getLogLevel(line: string): string {
  if (line.includes(" ERROR ") || line.includes("[ERROR]")) return "ERROR";
  if (line.includes(" WARN ") || line.includes("[WARN]")) return "WARN";
  if (line.includes(" DEBUG ") || line.includes("[DEBUG]")) return "DEBUG";
  return "INFO";
}

/** Monospace log viewer with auto-scroll and live tail. */
export function LogTail({ agentId }: LogTailProps) {
  const [lines, setLines] = useState<string[]>([]);
  const [liveTail, setLiveTail] = useState(true);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load initial lines
  useEffect(() => {
    setLoading(true);
    tailLog(agentId, 200)
      .then((initial) => {
        setLines(initial ?? []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load logs:", err);
        setLoading(false);
      });
  }, [agentId]);

  // Start live tail
  useEffect(() => {
    if (!liveTail) return;
    if (!isTauriAvailable()) return;

    startLogTail(agentId).catch(console.error);

    const unlisten = listen<{ agentId: string; line: string }>(
      "log:line",
      (event) => {
        if (event.payload.agentId === agentId) {
          setLines((prev) => {
            const next = [...prev, event.payload.line];
            // Cap at 10000 lines
            return next.length > 10000 ? next.slice(-10000) : next;
          });
        }
      },
    );

    return () => {
      stopLogTail(agentId).catch(console.error);
      unlisten.then((fn) => fn());
    };
  }, [agentId, liveTail]);

  // Auto-scroll
  useEffect(() => {
    if (liveTail && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines.length, liveTail]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    // If user scrolls up, pause live tail
    if (scrollHeight - scrollTop - clientHeight > 100) {
      setLiveTail(false);
    }
  }, []);

  const jumpToBottom = () => {
    setLiveTail(true);
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const filteredLines = searchQuery
    ? lines.filter((l) => l.toLowerCase().includes(searchQuery.toLowerCase()))
    : lines;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-sm text-text-tertiary">Loading logs…</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-border-primary px-4 py-2">
        {searchOpen && (
          <input
            autoFocus
            placeholder="Search logs…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 w-64 rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-2 text-xs text-text-primary"
          />
        )}
        {!searchOpen && (
          <Button variant="ghost" size="sm" onClick={() => setSearchOpen(true)}>
            🔍 Search
          </Button>
        )}
        <button
          onClick={() => setLiveTail(!liveTail)}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs hover:bg-bg-hover"
        >
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              liveTail ? "bg-status-success animate-pulse-dot" : "bg-text-tertiary",
            )}
          />
          {liveTail ? "Live" : "Paused"}
        </button>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLines([])}
        >
          Clear
        </Button>
      </div>

      {/* Log content */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto bg-bg-primary p-4 font-mono text-xs leading-5"
      >
        {filteredLines.length === 0 ? (
          <EmptyState icon="📋" title="No log output" />
        ) : (
          filteredLines.map((line, i) => {
            const level = getLogLevel(line);
            return (
              <div
                key={i}
                className={cn(
                  "whitespace-pre-wrap break-all",
                  LOG_LEVEL_COLORS[level] || "text-text-primary",
                )}
              >
                {line}
              </div>
            );
          })
        )}
      </div>

      {/* Jump to bottom */}
      {!liveTail && (
        <div className="absolute bottom-16 right-8">
          <Button size="sm" variant="secondary" onClick={jumpToBottom}>
            ↓ Jump to bottom
          </Button>
        </div>
      )}
    </div>
  );
}
