/**
 * Gateway connection state store.
 *
 * Tracks the WebSocket connection lifecycle, URL, version info,
 * and reconnection state.
 */

import { create } from "zustand";
import type { ConnectionState } from "../types/gateway";
import {
  connectGateway,
  disconnectGateway,
  getToken,
} from "../services/tauri-commands";

interface GatewayStore {
  /** Current WebSocket connection state. */
  connectionState: ConnectionState;
  /** Gateway URL (e.g., "ws://localhost:18789"). */
  url: string;
  /** Gateway version string, if known. */
  version: string | null;
  /** Gateway uptime in seconds, if known. */
  uptime: number | null;
  /** Current reconnection attempt number. */
  reconnectAttempt: number;
  /** Last error message. */
  lastError: string | null;

  // Actions
  /** Initiate a connection to the Gateway. */
  connect: (url: string, token: string) => Promise<void>;
  /** Disconnect from the Gateway. */
  disconnect: () => Promise<void>;
  /** Auto-connect using stored token. */
  autoConnect: (url?: string) => Promise<void>;
  /** Update the connection state. */
  setConnectionState: (state: ConnectionState) => void;
  /** Update the reconnection attempt number. */
  setReconnectAttempt: (attempt: number) => void;
  /** Update the last error. */
  setLastError: (error: string | null) => void;
  /** Update gateway info (version, uptime). */
  setGatewayInfo: (version: string, uptime: number) => void;
}

export const useGatewayStore = create<GatewayStore>((set, get) => ({
  connectionState: "disconnected",
  url: "ws://localhost:18789",
  version: null,
  uptime: null,
  reconnectAttempt: 0,
  lastError: null,

  connect: async (url: string, token: string) => {
    set({ connectionState: "connecting", url, lastError: null });
    try {
      await connectGateway(url, token);
    } catch (err) {
      set({
        connectionState: "disconnected",
        lastError: err instanceof Error ? err.message : String(err),
      });
    }
  },

  disconnect: async () => {
    try {
      await disconnectGateway();
    } catch (err) {
      console.error("Disconnect error:", err);
    }
    set({ connectionState: "disconnected", reconnectAttempt: 0 });
  },

  autoConnect: async (url?: string) => {
    const gatewayUrl = url || get().url;
    try {
      const token = await getToken();
      if (token) {
        await get().connect(gatewayUrl, token);
      }
    } catch (err) {
      console.error("Auto-connect failed:", err);
    }
  },

  setConnectionState: (state: ConnectionState) =>
    set({ connectionState: state }),

  setReconnectAttempt: (attempt: number) =>
    set({ reconnectAttempt: attempt }),

  setLastError: (error: string | null) => set({ lastError: error }),

  setGatewayInfo: (version: string, uptime: number) =>
    set({ version, uptime }),
}));
