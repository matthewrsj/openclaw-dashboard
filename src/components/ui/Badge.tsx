import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "success" | "warning" | "error" | "secondary";
}

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset",
        {
          "bg-bg-secondary text-text-primary ring-border-primary":
            variant === "default",
          "bg-status-success/10 text-status-success ring-status-success/20":
            variant === "success",
          "bg-status-warning/10 text-status-warning ring-status-warning/20":
            variant === "warning",
          "bg-status-error/10 text-status-error ring-status-error/20":
            variant === "error",
          "bg-bg-tertiary text-text-secondary ring-border-secondary":
            variant === "secondary",
        },
        className,
      )}
      {...props}
    />
  );
}