import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-text-primary">
            {label}
          </label>
        )}
        <input
          id={id}
          ref={ref}
          className={cn(
            "h-8 rounded-md border bg-[var(--input-bg)] px-3 text-sm text-text-primary placeholder:text-text-tertiary",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--input-focus-ring)]",
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
Input.displayName = "Input";

export { Input };
