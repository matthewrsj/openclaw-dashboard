/**
 * Channel state store.
 *
 * Tracks connected communication channels and their per-account health status
 * via the Gateway's channels.status RPC.
 */

import { create } from "zustand";
import type { ChannelInfo, ChannelAccount } from "../types/channel";
import { gatewayRpc, execCliJson, execCli } from "../services/tauri-commands";

/** A channel→agent binding. */
export interface ChannelBinding {
  agentId: string;
  channel: string;
  accountId: string;
  description: string;
}

interface ChannelStore {
  /** List of channels with per-account detail. */
  channels: ChannelInfo[];
  /** Current bindings (channel account → agent). */
  bindings: ChannelBinding[];
  /** Whether fetch is in progress. */
  loading: boolean;
  /** Error from last fetch. */
  error: string | null;

  // Actions
  fetchChannels: () => Promise<void>;
  fetchBindings: () => Promise<void>;
  bindAccount: (agentId: string, channel: string, accountId: string) => Promise<void>;
  unbindAccount: (agentId: string, channel: string, accountId: string) => Promise<void>;
  handleChannelEvent: (data: Record<string, unknown>) => void;
}

/** Derive overall channel status from account states. */
function deriveChannelStatus(accounts: ChannelAccount[]): ChannelInfo["status"] {
  if (accounts.length === 0) return "unconfigured";
  const enabled = accounts.filter((a) => a.enabled);
  if (enabled.length === 0) return "disconnected";
  const ok = enabled.filter((a) => a.status === "ok").length;
  const errored = enabled.filter((a) => a.status === "error").length;
  if (ok === enabled.length) return "connected";
  if (errored === enabled.length) return "error";
  if (ok > 0) return "partial";
  return "disconnected";
}

export const useChannelStore = create<ChannelStore>((set, get) => ({
  channels: [],
  bindings: [],
  loading: false,
  error: null,

  fetchChannels: async () => {
    set({ loading: true, error: null });
    try {
      const result = await gatewayRpc<{
        channelOrder?: string[];
        channelLabels?: Record<string, string>;
        channels?: Record<string, { configured?: boolean }>;
        channelAccounts?: Record<string, Array<Record<string, unknown>>>;
        channelDefaultAccountId?: Record<string, string>;
      }>("channels.status", {});

      // Tauri not available
      if (result === null) {
        set({ channels: [], loading: false });
        return;
      }

      const order = result.channelOrder || Object.keys(result.channels || {});
      const labels = result.channelLabels || {};
      const accountsMap = result.channelAccounts || {};
      const defaultIds = result.channelDefaultAccountId || {};
      const summaries = result.channels || {};

      const channels: ChannelInfo[] = order.map((channelId) => {
        const rawAccounts = accountsMap[channelId] || [];
        const accounts: ChannelAccount[] = rawAccounts.map((raw) => ({
          accountId: (raw.accountId as string) || "default",
          configured: (raw.configured as boolean) ?? false,
          enabled: (raw.enabled as boolean) ?? true,
          status: (raw.status as ChannelAccount["status"]) || "unknown",
          error: (raw.error as string) || null,
          warnings: Array.isArray(raw.warnings) ? (raw.warnings as string[]) : [],
          lastInboundAt: (raw.lastInboundAt as number) || null,
          lastOutboundAt: (raw.lastOutboundAt as number) || null,
          lastProbeAt: (raw.lastProbeAt as number) || null,
          botUsername: (raw.botUsername as string) || (raw.username as string) || null,
        }));

        const summary = summaries[channelId];
        const healthyCount = accounts.filter((a) => a.status === "ok").length;
        const errorCount = accounts.filter((a) => a.status === "error").length;

        return {
          type: channelId,
          id: channelId,
          label: labels[channelId] || channelId,
          status: deriveChannelStatus(accounts),
          configured: summary?.configured ?? accounts.some((a) => a.configured),
          accounts,
          defaultAccountId: defaultIds[channelId] || null,
          accountCount: accounts.length,
          healthyCount,
          errorCount,
        };
      });

      set({ channels, loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : String(err),
        loading: false,
      });
    }
  },

  fetchBindings: async () => {
    try {
      const result = await execCliJson<
        Array<{ agentId: string; match: { channel: string; accountId?: string }; description: string }>
      >(["agents", "bindings"]);
      if (!result) return;
      const bindings: ChannelBinding[] = result.map((b) => ({
        agentId: b.agentId,
        channel: b.match.channel,
        accountId: b.match.accountId || "default",
        description: b.description,
      }));
      set({ bindings });
    } catch (err) {
      console.warn("Failed to fetch bindings:", err);
    }
  },

  bindAccount: async (agentId: string, channel: string, accountId: string) => {
    const binding = accountId && accountId !== "default"
      ? `${channel}:${accountId}`
      : channel;
    const result = await execCli(["agents", "bind", "--agent", agentId, "--bind", binding]);
    if (result && result.exitCode !== 0) {
      throw new Error(result.stderr || "Failed to bind");
    }
    // Refresh bindings
    await get().fetchBindings();
  },

  unbindAccount: async (agentId: string, channel: string, accountId: string) => {
    const binding = accountId && accountId !== "default"
      ? `${channel}:${accountId}`
      : channel;
    const result = await execCli(["agents", "unbind", "--agent", agentId, "--bind", binding]);
    if (result && result.exitCode !== 0) {
      throw new Error(result.stderr || "Failed to unbind");
    }
    // Refresh bindings
    await get().fetchBindings();
  },

  handleChannelEvent: (data: Record<string, unknown>) => {
    const channelId = (data.channelId as string) || "";
    if (!channelId) return;

    const channels = [...get().channels];
    const idx = channels.findIndex((c) => c.id === channelId);
    if (idx >= 0) {
      // Refresh on next render cycle
      get().fetchChannels();
    }
  },
}));
