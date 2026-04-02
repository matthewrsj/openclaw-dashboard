/**
 * Gateway event router.
 *
 * Listens for `gateway:event` Tauri events and dispatches them
 * to the appropriate Zustand stores for state updates.
 */

import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { GatewayEventPayload } from "../types/gateway";
import { useAgentStore } from "../stores/agents";
import { useGatewayStore } from "../stores/gateway";
import { useSessionStore } from "../stores/sessions";
import { useChatStore } from "../stores/chat";
import { useCronStore } from "../stores/cron";
import { useChannelStore } from "../stores/channels";
import { useUIStore } from "../stores/ui";
import { isTauriAvailable } from "./tauri-commands";

/** Start listening for Gateway events and routing to stores. */
export async function startEventRouter(): Promise<UnlistenFn> {
  if (!isTauriAvailable()) {
    console.warn("Tauri not available — skipping event router listener");
    return () => {};
  }
  return listen<GatewayEventPayload>("gateway:event", (event) => {
    const { event: eventType, data } = event.payload;
    routeEvent(eventType, data);
  });
}

/** Route a single Gateway event to the appropriate store(s). */
function routeEvent(
  eventType: string,
  data: Record<string, unknown>,
): void {
  // Any event arriving proves the connection is alive.
  // Fix stale "disconnected" status if we're receiving events.
  const gw = useGatewayStore.getState();
  if (gw.connectionState !== "connected") {
    gw.setConnectionState("connected");
    gw.setLastError(null);
  }

  switch (eventType) {
    // Session lifecycle
    case "session.created":
    case "session.updated":
    case "session.ended":
      useSessionStore.getState().handleSessionEvent(eventType, data);
      break;

    // Agent status changes
    case "agent.status":
      useAgentStore.getState().handleAgentEvent(data);
      break;

    // Subagent lifecycle
    case "subagent.spawned":
    case "subagent.completed":
    case "subagent.failed":
      useAgentStore.getState().handleSubagentEvent(eventType, data);
      break;

    // Cron run events
    case "cron.run.started":
    case "cron.run.completed":
      useCronStore.getState().handleCronEvent(eventType, data);
      break;

    // Chat streaming events (single "chat" event with state: delta|final|aborted|error)
    case "chat":
      useChatStore.getState().handleChatEvent(data);
      break;

    // Channel status
    case "channel.status":
      useChannelStore.getState().handleChannelEvent(data);
      break;

    // Exec approval requests
    case "exec.approval":
      useUIStore.getState().addToast({
        type: "warning",
        message: `Exec approval needed for ${(data.agentId as string) || "agent"}`,
        description: data.command as string,
        duration: null, // persistent
      });
      break;

    // General notifications
    case "notification":
      useUIStore.getState().addToast({
        type: (data.severity as "info" | "warning" | "error") || "info",
        message: (data.message as string) || "Notification",
      });
      break;

    default:
      console.warn(`Unhandled Gateway event: ${eventType}`, data);
  }
}
