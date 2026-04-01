import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;
  showLabel?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function ProgressBar({ value, showLabel = false, size = "sm", className }: ProgressBarProps) {
  const clamped = Math.min(Math.max(value, 0), 100);
  const colorClass = clamped >= 95 ? "bg-status-error" : clamped >= 80 ? "bg-status-warning" : "bg-status-success";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn("flex-1 rounded-full bg-border-primary", size === "sm" ? "h-1.5" : "h-2")}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn("rounded-full transition-all duration-300 ease-out", size === "sm" ? "h-1.5" : "h-2", colorClass)}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && <span className="text-xs text-text-secondary tabular-nums">{Math.round(clamped)}%</span>}
    </div>
  );
}
