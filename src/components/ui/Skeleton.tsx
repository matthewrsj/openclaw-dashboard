import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

/** Animated loading placeholder. */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn("animate-shimmer rounded-md", className)}
      aria-hidden="true"
    />
  );
}
