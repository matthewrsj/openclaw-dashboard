import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize from "rehype-sanitize";
import type { ChatMessage as ChatMessageType } from "@/types/chat";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  message: ChatMessageType;
  agentEmoji?: string;
}

/** Single chat message with markdown rendering. */
export const ChatMessage = memo(function ChatMessage({
  message,
  agentEmoji,
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
          <span className="text-text-tertiary animate-pulse">…</span>
        ) : (
          <div className="prose prose-sm max-w-none text-text-primary">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
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
