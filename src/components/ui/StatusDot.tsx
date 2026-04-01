import { cn } from "@/lib/utils";

interface StatusDotProps {
  status: "success" | "warning" | "error" | "inactive";
  size?: "sm" | "md" | "lg";
  className?: string;
  pulse?: boolean;
}

const STATUS_COLORS = {
  success: "bg-status-success",
  warning: "bg-status-warning",
  error: "bg-status-error",
  inactive: "bg-text-tertiary",
};

const STATUS_SIZES = {
  sm: "h-2 w-2",
  md: "h-3 w-3",
  lg: "h-4 w-4",
};

export function StatusDot({
  status,
  size = "md",
  className,
  pulse = false,
}: StatusDotProps) {
  return (
    <div
      className={cn(
        "rounded-full",
        STATUS_COLORS[status],
        STATUS_SIZES[size],
        pulse && "animate-pulse-dot",
        className,
      )}
    />
  );
}