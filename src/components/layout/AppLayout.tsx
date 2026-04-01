import { Outlet } from "@tanstack/react-router";
import { Sidebar } from "./Sidebar";
import { StatusBar } from "./StatusBar";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { useUIStore } from "@/stores/ui";
import { cn } from "@/lib/utils";

export function AppLayout() {
  const sidebarExpanded = useUIStore((state) => state.sidebarExpanded);

  return (
    <div className="flex h-screen bg-bg-primary">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div
        className={cn(
          "flex flex-1 flex-col transition-all duration-200",
          sidebarExpanded ? "ml-64" : "ml-16",
        )}
      >
        {/* Main content area */}
        <main className="flex-1 overflow-hidden">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>

        {/* Status Bar */}
        <StatusBar />
      </div>
    </div>
  );
}