/**
 * Frontend-side WebSocket event listener.
 *
 * Bridges Tauri backend events to the frontend stores via the event router.
 * HMR-safe: connection state handlers read from stores at call time,
 * not at registration time.
 */

import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  ConnectionEventPayload,
  DisconnectEventPayload,
  ReconnectingEventPayload,
} from "../types/gateway";
import { useGatewayStore } from "../stores/gateway";
import { startEventRouter } from "./gateway-event-router";
import { isTauriAvailable } from "./tauri-commands";

/** Whether listeners have already been initialized. */
let initialized = false;

/** Registered unlisten functions for cleanup. */
let unlisteners: UnlistenFn[] = [];

/**
 * Initialize all Gateway event listeners.
 *
 * HMR-safe: handlers call `useGatewayStore.getState()` at invocation time
 * rather than capturing the store at registration time.
 */
export async function initGatewayListeners(): Promise<() => void> {
  if (!isTauriAvailable()) {
    console.warn("Tauri not available — skipping Gateway event listeners");
    return () => {};
  }

  if (initialized) {
    return () => cleanupGatewayListeners();
  }
  initialized = true;

  // Connection established — read store fresh each time
  const unlistenConnected = await listen<ConnectionEventPayload>(
    "gateway:connected",
    (event) => {
      const gw = useGatewayStore.getState();
      gw.setConnectionState("connected");
      gw.setLastError(null);
      console.info(`Gateway connected: ${event.payload.url}`);
    },
  );
  unlisteners.push(unlistenConnected);

  // Disconnection
  const unlistenDisconnected = await listen<DisconnectEventPayload>(
    "gateway:disconnected",
    (event) => {
      const gw = useGatewayStore.getState();
      const { reason, willRetry } = event.payload;
      gw.setConnectionState(willRetry ? "reconnecting" : "disconnected");
      gw.setLastError(reason);
      console.info(`Gateway disconnected: ${reason} (retry: ${willRetry})`);
    },
  );
  unlisteners.push(unlistenDisconnected);

  // Reconnecting
  const unlistenReconnecting = await listen<ReconnectingEventPayload>(
    "gateway:reconnecting",
    (event) => {
      const gw = useGatewayStore.getState();
      gw.setConnectionState("reconnecting");
      gw.setReconnectAttempt(event.payload.attempt);
    },
  );
  unlisteners.push(unlistenReconnecting);

  // Gateway push events → store router
  const unlistenEvents = await startEventRouter();
  unlisteners.push(unlistenEvents);

  return () => cleanupGatewayListeners();
}

/** Clean up all registered Gateway event listeners. */
export function cleanupGatewayListeners(): void {
  for (const unlisten of unlisteners) {
    unlisten();
  }
  unlisteners = [];
  initialized = false;
}
