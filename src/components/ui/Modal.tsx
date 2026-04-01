import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ModalProps {
  isOpen?: boolean;
  open?: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
  footer?: ReactNode;
  preventClose?: boolean;
}

export function Modal({ isOpen, open, onClose, title, children, size = "md", footer, preventClose }: ModalProps) {
  const visible = isOpen ?? open ?? true;
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 transition-opacity"
          onClick={preventClose ? undefined : onClose}
        />
        
        {/* Modal */}
        <div
          className={cn(
            "relative bg-bg-primary rounded-lg shadow-lg",
            {
              "w-[480px]": size === "sm",
              "w-[640px]": size === "md", 
              "w-[800px]": size === "lg",
            }
          )}
        >
          {title && (
            <div className="border-b border-border-primary p-6">
              <h2 className="text-lg font-semibold">{title}</h2>
            </div>
          )}
          <div className="p-6">{children}</div>
          {footer && (
            <div className="flex justify-end gap-2 border-t border-border-primary px-6 py-4">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}