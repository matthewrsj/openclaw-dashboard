/**
 * Channel state store.
 *
 * Tracks connected communication channels and their health status.
 */

import { create } from "zustand";
import type { ChannelInfo } from "../types/channel";
import { gatewayRpc } from "../services/tauri-commands";

interface ChannelStore {
  /** List of channels. */
  channels: ChannelInfo[];
  /** Whether fetch is in progress. */
  loading: boolean;
  /** Error from last fetch. */
  error: string | null;

  // Actions
  fetchChannels: () => Promise<void>;
  handleChannelEvent: (data: Record<string, unknown>) => void;

  // Selectors
  getConnectedChannels: () => ChannelInfo[];
}

export const useChannelStore = create<ChannelStore>((set, get) => ({
  channels: [],
  loading: false,
  error: null,

  fetchChannels: async () => {
    set({ loading: true, error: null });
    try {
      const health = await gatewayRpc<{
        channels: Record<string, { status: string; error?: string }>;
      }>("health");

      // Tauri not available
      if (health === null) {
        set({ channels: [], loading: false });
        return;
      }

      const channels: ChannelInfo[] = Object.entries(
        health.channels || {},
      ).map(([id, info]) => ({
        type: id.split(":")[0] as ChannelInfo["type"],
        id,
        status: info.status === "ok" ? "connected" : "error",
        agentId: null,
        agentName: null,
        agentEmoji: null,
        lastMessageAt: null,
        error: info.error || null,
        disconnectedAt: null,
      }));

      set({ channels, loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : String(err),
        loading: false,
      });
    }
  },

  handleChannelEvent: (data: Record<string, unknown>) => {
    const channelId = (data.channelId as string) || "";
    if (!channelId) return;

    const channels = [...get().channels];
    const idx = channels.findIndex((c) => c.id === channelId);
    if (idx >= 0) {
      channels[idx] = {
        ...channels[idx],
        status: (data.status as ChannelInfo["status"]) || channels[idx].status,
        error: (data.error as string) || null,
      };
      set({ channels });
    }
  },

  getConnectedChannels: () =>
    get().channels.filter((c) => c.status === "connected"),
}));
