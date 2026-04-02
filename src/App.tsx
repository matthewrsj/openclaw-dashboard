import { useCallback, useEffect, useState } from "react";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { useSettingsStore } from "@/stores/settings";
import { useGatewayStore } from "@/stores/gateway";
import { useAgentStore } from "@/stores/agents";
import { useSessionStore } from "@/stores/sessions";
import { useCronStore } from "@/stores/cron";
import { useModelStore } from "@/stores/models";
import { useUIStore } from "@/stores/ui";
import { initGatewayListeners } from "@/services/gateway-ws";
import { ToastContainer } from "@/components/ui/Toast";
import { CreateAgentModal } from "@/components/modals/CreateAgentModal";
import { DeleteConfirmModal } from "@/components/modals/DeleteConfirmModal";
import { ConnectionModal } from "@/components/modals/ConnectionModal";
import { CronForm } from "@/components/cron/CronForm";
import { OnboardingOverlay } from "@/components/onboarding/OnboardingOverlay";
import "@/styles/globals.css";

// Create a new router instance
const router = createRouter({ routeTree });

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

function App() {
  const loadSettings = useSettingsStore((state) => state.loadSettings);
  const autoConnect = useGatewayStore((state) => state.autoConnect);
  const fetchAgents = useAgentStore((state) => state.fetchAgents);
  const fetchSessions = useSessionStore(
    (state) => state.fetchSessions,
  );
  const fetchCronJobs = useCronStore((state) => state.fetchJobs);
  const fetchModels = useModelStore((state) => state.fetchModels);
  const activeModal = useUIStore((s) => s.activeModal);
  const closeModal = useUIStore((s) => s.closeModal);

  // Onboarding state
  const connectionState = useGatewayStore(
    (s) => s.connectionState,
  );
  const agentList = useAgentStore((s) => s.agentList);
  const hasCompletedOnboarding = useSettingsStore(
    (s) => s.hasCompletedOnboarding,
  );
  const setHasCompletedOnboarding = useSettingsStore(
    (s) => s.setHasCompletedOnboarding,
  );
  const [appInitialized, setAppInitialized] = useState(false);

  const showOnboarding =
    appInitialized &&
    !hasCompletedOnboarding &&
    connectionState === "disconnected" &&
    agentList.length === 0;

  const handleOnboardingComplete = useCallback(() => {
    setHasCompletedOnboarding(true);
  }, [setHasCompletedOnboarding]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    // Initialize app
    const initializeApp = async () => {
      // Load settings first
      await loadSettings();

      // Initialize Gateway event listeners (returns cleanup fn)
      cleanup = await initGatewayListeners();

      // Try to auto-connect if token exists
      await autoConnect();

      // Fetch initial data
      await fetchAgents();
      await fetchSessions();
      await fetchCronJobs();
      await fetchModels();
    };

    initializeApp()
      .catch((err) => {
        // Don't crash the app if initialization fails
        console.warn(
          "App initialization failed (non-fatal):",
          err,
        );
      })
      .finally(() => {
        setAppInitialized(true);
      });

    return () => {
      cleanup?.();
    };
  }, [loadSettings, autoConnect, fetchAgents, fetchSessions, fetchCronJobs, fetchModels]);

  // Auto-refresh agent status, sessions, and cron data every 30 seconds
  // Also poll the Rust backend for actual connection state to fix stale status
  useEffect(() => {
    const interval = setInterval(async () => {
      fetchAgents().catch(console.warn);
      fetchSessions().catch(console.warn);
      fetchCronJobs().catch(console.warn);
      fetchModels().catch(console.warn);

      // Sync connection state from Rust backend
      try {
        const { getConnectionState } = await import("@/services/tauri-commands");
        const state = await getConnectionState();
        if (state) {
          const gw = useGatewayStore.getState();
          const mapped = state as "connected" | "connecting" | "reconnecting" | "disconnected";
          if (gw.connectionState !== mapped) {
            gw.setConnectionState(mapped);
            if (mapped === "connected") gw.setLastError(null);
          }
        }
      } catch { /* non-fatal */ }
    }, 30_000);

    return () => clearInterval(interval);
  }, [fetchAgents, fetchSessions, fetchCronJobs, fetchModels]);

  // System theme listener
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const theme = useSettingsStore.getState().theme;
      if (theme === "system") {
        // Re-trigger CSS by removing data-theme so @media rule applies
        document.documentElement.removeAttribute("data-theme");
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <>
      <RouterProvider router={router} />
      <ToastContainer />

      {/* Modal layer */}
      {activeModal?.type === "create-agent" && (
        <CreateAgentModal open onClose={closeModal} />
      )}
      {activeModal?.type === "delete-agent" && (
        <DeleteConfirmModal
          open
          onClose={closeModal}
          agentId={(activeModal.props?.agentId as string) || ""}
          agentName={(activeModal.props?.agentName as string) || ""}
        />
      )}
      {activeModal?.type === "connection" && (
        <ConnectionModal open onClose={closeModal} />
      )}
      {activeModal?.type === "create-cron" && (
        <CronForm open onClose={closeModal} />
      )}

      {/* Onboarding overlay for first-run setup */}
      {showOnboarding && (
        <OnboardingOverlay onComplete={handleOnboardingComplete} />
      )}
    </>
  );
}

export default App;