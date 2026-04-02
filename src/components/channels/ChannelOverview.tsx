import { useEffect, useState } from "react";
import { useChannelStore, type ChannelBinding } from "@/stores/channels";
import { useAgentStore } from "@/stores/agents";
import { useUIStore } from "@/stores/ui";
import { StatusDot } from "@/components/ui/StatusDot";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatRelativeTime } from "@/lib/format";
import type { ChannelInfo, ChannelAccount } from "@/types/channel";

const CHANNEL_ICONS: Record<string, string> = {
  webchat: "💬",
  telegram: "✈️",
  discord: "🎮",
  whatsapp: "📱",
  slack: "💼",
  signal: "🔒",
};

function accountStatusDot(status: ChannelAccount["status"]) {
  switch (status) {
    case "ok": return "success" as const;
    case "error": return "error" as const;
    case "disabled":
    case "unconfigured": return "inactive" as const;
    default: return "warning" as const;
  }
}

function channelStatusBadge(status: ChannelInfo["status"]) {
  switch (status) {
    case "connected": return { variant: "success" as const, label: "Connected" };
    case "partial": return { variant: "warning" as const, label: "Partial" };
    case "error": return { variant: "error" as const, label: "Error" };
    case "disconnected": return { variant: "secondary" as const, label: "Disconnected" };
    case "unconfigured": return { variant: "secondary" as const, label: "Not Configured" };
  }
}

function AccountRow({
  account,
  channelType,
  binding,
  agents,
  onBind,
  onUnbind,
}: {
  account: ChannelAccount;
  channelType: string;
  binding: ChannelBinding | undefined;
  agents: Array<{ id: string; name: string; emoji: string }>;
  onBind: (agentId: string, channel: string, accountId: string) => void;
  onUnbind: (agentId: string, channel: string, accountId: string) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const lastActivity = account.lastInboundAt || account.lastOutboundAt;
  const boundAgent = binding ? agents.find((a) => a.id === binding.agentId) : null;

  const handleBind = async (agentId: string) => {
    setBusy(true);
    try {
      await onBind(agentId, channelType, account.accountId);
    } finally {
      setBusy(false);
      setShowPicker(false);
    }
  };

  const handleUnbind = async () => {
    if (!binding) return;
    setBusy(true);
    try {
      await onUnbind(binding.agentId, channelType, account.accountId);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-md bg-bg-primary/50">
      <div className="flex items-center gap-3 py-2 px-3">
        <StatusDot
          status={accountStatusDot(account.status)}
          size="sm"
          pulse={account.status === "ok"}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-primary">
              {account.accountId}
            </span>
            {account.botUsername && (
              <span className="text-xs text-text-tertiary">
                @{account.botUsername}
              </span>
            )}
            {!account.enabled && (
              <Badge variant="secondary">disabled</Badge>
            )}
          </div>
          {account.error && (
            <p className="text-xs text-status-error mt-0.5 truncate">
              {account.error}
            </p>
          )}
        </div>

        {/* Binding indicator / controls */}
        <div className="flex items-center gap-2 shrink-0">
          {boundAgent ? (
            <>
              <span className="text-xs text-text-secondary">
                {boundAgent.emoji} {boundAgent.name}
              </span>
              <button
                type="button"
                onClick={handleUnbind}
                disabled={busy}
                className="text-xs text-text-tertiary hover:text-status-error disabled:opacity-50"
                title="Unbind"
              >
                ✕
              </button>
            </>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowPicker(!showPicker)}
              disabled={busy}
            >
              Bind
            </Button>
          )}
          <span className="text-xs text-text-tertiary whitespace-nowrap">
            {lastActivity ? formatRelativeTime(lastActivity) : ""}
          </span>
        </div>
      </div>

      {/* Agent picker dropdown */}
      {showPicker && (
        <div className="px-3 pb-2">
          <div className="flex flex-wrap gap-1 mt-1">
            {agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => handleBind(agent.id)}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-md border border-border-primary px-2.5 py-1 text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors disabled:opacity-50"
              >
                <span>{agent.emoji}</span>
                <span>{agent.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ChannelCard({
  channel,
  bindings,
  agents,
  onBind,
  onUnbind,
}: {
  channel: ChannelInfo;
  bindings: ChannelBinding[];
  agents: Array<{ id: string; name: string; emoji: string }>;
  onBind: (agentId: string, channel: string, accountId: string) => void;
  onUnbind: (agentId: string, channel: string, accountId: string) => void;
}) {
  const badge = channelStatusBadge(channel.status);
  const icon = CHANNEL_ICONS[channel.type] || "📡";

  // Find binding for each account
  const getBinding = (accountId: string) =>
    bindings.find(
      (b) => b.channel === channel.type && b.accountId === accountId,
    );

  const boundCount = channel.accounts.filter((a) => getBinding(a.accountId)).length;

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-2">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">{icon}</span>
          <div>
            <h3 className="font-semibold text-text-primary">{channel.label}</h3>
            <span className="text-xs text-text-tertiary">
              {channel.accountCount} account{channel.accountCount !== 1 ? "s" : ""}
              {boundCount > 0 && <> · {boundCount} bound</>}
              {channel.errorCount > 0 && (
                <> · <span className="text-status-error">{channel.errorCount} errored</span></>
              )}
            </span>
          </div>
        </div>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>

      {/* Accounts */}
      {channel.accounts.length > 0 && (
        <div className="px-4 pb-4 space-y-1">
          {channel.accounts.map((account) => (
            <AccountRow
              key={account.accountId}
              account={account}
              channelType={channel.type}
              binding={getBinding(account.accountId)}
              agents={agents}
              onBind={onBind}
              onUnbind={onUnbind}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

export function ChannelOverview() {
  const channels = useChannelStore((s) => s.channels);
  const bindings = useChannelStore((s) => s.bindings);
  const loading = useChannelStore((s) => s.loading);
  const error = useChannelStore((s) => s.error);
  const fetchChannels = useChannelStore((s) => s.fetchChannels);
  const fetchBindings = useChannelStore((s) => s.fetchBindings);
  const bindAccount = useChannelStore((s) => s.bindAccount);
  const unbindAccount = useChannelStore((s) => s.unbindAccount);
  const addToast = useUIStore((s) => s.addToast);

  const agentList = useAgentStore((s) =>
    s.agentList.map((a) => ({ id: a.id, name: a.name, emoji: a.emoji })),
  );

  useEffect(() => {
    fetchChannels();
    fetchBindings();
  }, [fetchChannels, fetchBindings]);

  const handleBind = async (agentId: string, channel: string, accountId: string) => {
    try {
      await bindAccount(agentId, channel, accountId);
      addToast({ type: "success", message: `Bound ${channel}:${accountId} → ${agentId}` });
    } catch (err) {
      addToast({ type: "error", message: err instanceof Error ? err.message : String(err) });
    }
  };

  const handleUnbind = async (agentId: string, channel: string, accountId: string) => {
    try {
      await unbindAccount(agentId, channel, accountId);
      addToast({ type: "success", message: `Unbound ${channel}:${accountId} from ${agentId}` });
    } catch (err) {
      addToast({ type: "error", message: err instanceof Error ? err.message : String(err) });
    }
  };

  if (error) {
    return (
      <EmptyState
        icon="⚠️"
        title="Failed to load channels"
        description={error}
        action={{ label: "Retry", onClick: fetchChannels }}
      />
    );
  }

  return (
    <div className="p-6">
      <h1 className="mb-6 text-xl font-semibold text-text-primary">
        Channels
      </h1>
      {loading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 rounded-lg" />
          ))}
        </div>
      ) : channels.length === 0 ? (
        <EmptyState
          icon="📡"
          title="No channels configured"
          description="Configure channels in the OpenClaw CLI."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {channels.map((channel) => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              bindings={bindings}
              agents={agentList}
              onBind={handleBind}
              onUnbind={handleUnbind}
            />
          ))}
        </div>
      )}
    </div>
  );
}
