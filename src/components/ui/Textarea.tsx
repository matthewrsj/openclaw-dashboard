import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-text-primary">
            {label}
          </label>
        )}
        <textarea
          id={id}
          ref={ref}
          className={cn(
            "min-h-[64px] rounded-md border bg-[var(--input-bg)] px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary",
            "resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--input-focus-ring)]",
            "disabled:cursor-not-allowed disabled:opacity-60",
            error
              ? "border-status-error"
              : "border-[var(--input-border)] hover:border-border-secondary",
            className,
          )}
          {...props}
        />
        {error && <p className="text-xs text-status-error">{error}</p>}
      </div>
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
