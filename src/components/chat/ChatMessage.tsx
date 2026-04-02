import { memo, useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize from "rehype-sanitize";
import type { ChatMessage as ChatMessageType } from "@/types/chat";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  message: ChatMessageType;
  agentEmoji?: string;
  agentName?: string;
}

const THINKING_VERBS = [
  "Thinking",
  "Pondering",
  "Mulling it over",
  "Cooking up a reply",
  "Rummaging through context",
  "Consulting the runes",
  "Warming up the neurons",
  "Composing thoughts",
  "Connecting dots",
  "Weighing options",
];

/** Animated placeholder while the agent is thinking (no content yet). */
function ThinkingIndicator({ agentName: _agentName }: { agentName?: string }) {
  const [verbIndex, setVerbIndex] = useState(
    () => Math.floor(Math.random() * THINKING_VERBS.length),
  );
  const [dots, setDots] = useState(1);

  useEffect(() => {
    // Cycle dots: . → .. → ... → .
    const dotTimer = setInterval(() => {
      setDots((d) => (d % 3) + 1);
    }, 500);

    // Rotate verb every 3s
    const verbTimer = setInterval(() => {
      setVerbIndex((i) => (i + 1) % THINKING_VERBS.length);
    }, 3000);

    return () => {
      clearInterval(dotTimer);
      clearInterval(verbTimer);
    };
  }, []);

  return (
    <span className="text-text-tertiary text-xs italic">
      {THINKING_VERBS[verbIndex]}{".".repeat(dots)}
    </span>
  );
}

/** Single chat message with markdown rendering. */
export const ChatMessage = memo(function ChatMessage({
  message,
  agentEmoji,
  agentName,
}: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex gap-3 px-4 py-3",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
      role="article"
    >
      {/* Avatar */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg-secondary text-sm">
        {isUser ? "👤" : agentEmoji || "🤖"}
      </div>

      {/* Content */}
      <div
        className={cn(
          "max-w-[80%] rounded-lg px-4 py-2.5 text-sm",
          isUser
            ? "bg-accent-primary/15 text-text-primary"
            : "bg-bg-secondary text-text-primary",
          message.status === "error" && "border border-status-error/30",
        )}
      >
        {message.status === "streaming" && !message.content ? (
          <ThinkingIndicator agentName={agentName} />
        ) : (
          <div className="prose prose-sm max-w-none text-text-primary [&>*+*]:mt-3 [&_p]:my-2 [&_br]:block [&_br]:content-[''] [&_br]:mt-2">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkBreaks]}
              rehypePlugins={[rehypeSanitize, rehypeHighlight]}
              components={{
                pre: ({ children, ...props }) => (
                  <pre
                    className="overflow-x-auto rounded-md bg-[var(--code-bg)] p-3 text-xs"
                    {...props}
                  >
                    {children}
                  </pre>
                ),
                code: ({ children, className, ...props }) => {
                  const isInline = !className;
                  return isInline ? (
                    <code
                      className="rounded bg-[var(--code-bg)] px-1 py-0.5 text-xs"
                      {...props}
                    >
                      {children}
                    </code>
                  ) : (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                },
                a: ({ children, href, ...props }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-primary hover:underline"
                    {...props}
                  >
                    {children}
                  </a>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {/* Streaming cursor */}
        {message.status === "streaming" && message.content && (
          <span className="inline-block h-4 w-1 animate-pulse bg-text-primary ml-0.5" />
        )}

        {/* Error */}
        {message.status === "error" && message.error && (
          <p className="mt-2 text-xs text-status-error">{message.error}</p>
        )}
      </div>
    </div>
  );
});
