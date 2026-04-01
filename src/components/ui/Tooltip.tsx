import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TooltipProps { content: string; children: ReactNode; position?: "top" | "bottom"; className?: string; }

export function Tooltip({ content, children, position = "top", className }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  let timer: ReturnType<typeof setTimeout>;
  const show = () => { timer = setTimeout(() => setVisible(true), 500); };
  const hide = () => { clearTimeout(timer); setVisible(false); };
  return (
    <div className={cn("relative inline-flex", className)} onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {visible && (
        <div className={cn(
          "absolute z-50 whitespace-nowrap rounded-md border border-border-primary bg-bg-tertiary px-2 py-1 text-xs text-text-primary shadow-lg",
          position === "top" ? "bottom-full left-1/2 -translate-x-1/2 mb-2" : "top-full left-1/2 -translate-x-1/2 mt-2",
        )}>{content}</div>
      )}
    </div>
  );
}
