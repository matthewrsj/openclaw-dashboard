import { cn } from "@/lib/utils";
import type { Toast as ToastType } from "@/types/ui";
import { useUIStore } from "@/stores/ui";

const ICONS: Record<ToastType["type"], string> = { success: "✓", error: "✗", warning: "⚠", info: "ℹ" };
const BORDER_COLORS: Record<ToastType["type"], string> = {
  success: "border-l-status-success", error: "border-l-status-error",
  warning: "border-l-status-warning", info: "border-l-status-info",
};
const ICON_COLORS: Record<ToastType["type"], string> = {
  success: "text-status-success", error: "text-status-error",
  warning: "text-status-warning", info: "text-status-info",
};

function ToastItem({ toast }: { toast: ToastType }) {
  const dismissToast = useUIStore((s) => s.dismissToast);
  return (
    <div
      role={toast.type === "error" ? "alert" : "status"}
      aria-live={toast.type === "error" ? "assertive" : "polite"}
      className={cn("animate-slide-up pointer-events-auto w-[360px] rounded-lg border border-border-primary bg-[var(--toast-bg)] shadow-lg border-l-4", BORDER_COLORS[toast.type])}
    >
      <div className="flex items-start gap-3 p-3">
        <span className={cn("text-sm font-bold", ICON_COLORS[toast.type])}>{ICONS[toast.type]}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-text-primary">{toast.message}</p>
          {toast.description && <p className="mt-1 text-xs text-text-secondary">{toast.description}</p>}
          {toast.action && (
            <button onClick={toast.action.onClick} className="mt-2 text-xs font-medium text-accent-primary hover:underline">
              {toast.action.label}
            </button>
          )}
        </div>
        <button onClick={() => dismissToast(toast.id)} className="text-text-tertiary hover:text-text-primary">✕</button>
      </div>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useUIStore((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col-reverse gap-2 pointer-events-none">
      {toasts.slice(-3).map((toast) => <ToastItem key={toast.id} toast={toast} />)}
    </div>
  );
}
