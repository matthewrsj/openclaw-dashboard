import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        className={cn(
          // Base styles
          "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary disabled:pointer-events-none disabled:opacity-50",
          // Variants
          {
            "bg-accent-primary text-white hover:bg-accent-primary-hover":
              variant === "primary",
            "bg-bg-secondary text-text-primary hover:bg-bg-tertiary":
              variant === "secondary",
            "border border-border-primary bg-transparent hover:bg-bg-hover":
              variant === "outline",
            "hover:bg-bg-hover": variant === "ghost",
            "bg-status-error text-white hover:bg-status-error/90":
              variant === "danger",
          },
          // Sizes
          {
            "h-8 px-3 text-sm": size === "sm",
            "h-9 px-4": size === "md",
            "h-10 px-6": size === "lg",
          },
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";

export { Button, type ButtonProps };