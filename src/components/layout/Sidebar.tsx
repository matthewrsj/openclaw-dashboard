import { useNavigate } from "@tanstack/react-router";
import { useUIStore } from "@/stores/ui";
import { useGatewayStore } from "@/stores/gateway";
import { cn } from "@/lib/utils";
import { SidebarNav } from "./SidebarNav";
import { SidebarAgents } from "./SidebarAgents";
import { Button } from "@/components/ui/Button";

export function Sidebar() {
  const { sidebarExpanded, toggleSidebar } = useUIStore();
  const openModal = useUIStore((s) => s.openModal);
  const connectionState = useGatewayStore((state) => state.connectionState);
  const navigate = useNavigate();

  return (
    <aside
      className={cn(
        "flex flex-col flex-shrink-0 border-r transition-all duration-200",
        sidebarExpanded ? "w-64" : "w-16",
      )}
      style={{
        borderColor: "var(--sidebar-border)",
        backgroundColor: "var(--sidebar-bg)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-sidebar-border p-4">
        {sidebarExpanded && (
          <div className="flex items-center space-x-2">
            <div className="text-lg font-semibold text-text-primary">
              OpenClaw
            </div>
            {connectionState === "connected" && (
              <div className="h-2 w-2 rounded-full bg-status-success" />
            )}
            {connectionState === "connecting" && (
              <div className="h-2 w-2 animate-pulse rounded-full bg-status-warning" />
            )}
            {connectionState === "disconnected" && (
              <button
                onClick={() => openModal({ type: "connection" })}
                className="flex items-center gap-1 cursor-pointer hover:opacity-80"
                title="Click to connect"
              >
                <div className="h-2 w-2 rounded-full bg-status-error" />
                <span className="text-xs text-status-error">Disconnected</span>
              </button>
            )}
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className="h-8 w-8 p-0"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </Button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto">
        <SidebarNav />
        {sidebarExpanded && <SidebarAgents />}
      </div>

      {/* Footer - Settings */}
      <div className="border-t border-sidebar-border p-4">
        <button
          onClick={() => navigate({ to: '/settings' })}
          className={cn(
            "flex w-full items-center rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-bg-hover text-text-secondary hover:text-text-primary",
            !sidebarExpanded && "w-8 justify-center p-0",
          )}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          {sidebarExpanded && <span className="ml-2">Settings</span>}
        </button>
      </div>
    </aside>
  );
}