/**
 * Frontend-side WebSocket event listener.
 *
 * Bridges Tauri backend events to the frontend stores via the event router.
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
 * Sets up listeners for connection state changes and Gateway push events.
 * Guards against double-initialization (e.g., React strict mode in dev).
 * Returns a cleanup function that tears down all listeners.
 *
 * When Tauri is not available (plain browser) the function is a no-op
 * and returns a no-op cleanup function so the rest of the app can render.
 */
export async function initGatewayListeners(): Promise<() => void> {
  // Guard: not inside Tauri
  if (!isTauriAvailable()) {
    console.warn("Tauri not available — skipping Gateway event listeners");
    return () => {};
  }

  // Guard against double-initialization
  if (initialized) {
    return () => cleanupGatewayListeners();
  }
  initialized = true;

  const gateway = useGatewayStore.getState();

  // Connection established
  const unlistenConnected = await listen<ConnectionEventPayload>(
    "gateway:connected",
    (event) => {
      gateway.setConnectionState("connected");
      gateway.setLastError(null);
      console.info(`Gateway connected: ${event.payload.url}`);
    },
  );
  unlisteners.push(unlistenConnected);

  // Disconnection
  const unlistenDisconnected = await listen<DisconnectEventPayload>(
    "gateway:disconnected",
    (event) => {
      const { reason, willRetry } = event.payload;
      gateway.setConnectionState(
        willRetry ? "reconnecting" : "disconnected",
      );
      gateway.setLastError(reason);
      console.info(`Gateway disconnected: ${reason} (retry: ${willRetry})`);
    },
  );
  unlisteners.push(unlistenDisconnected);

  // Reconnecting
  const unlistenReconnecting = await listen<ReconnectingEventPayload>(
    "gateway:reconnecting",
    (event) => {
      gateway.setConnectionState("reconnecting");
      gateway.setReconnectAttempt(event.payload.attempt);
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
