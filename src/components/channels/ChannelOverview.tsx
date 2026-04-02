import { useEffect } from "react";
import { useChannelStore } from "@/stores/channels";
import { StatusDot } from "@/components/ui/StatusDot";
import { Badge } from "@/components/ui/Badge";
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

function AccountRow({ account }: { account: ChannelAccount }) {
  const lastActivity = account.lastInboundAt || account.lastOutboundAt;

  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-md bg-bg-primary/50">
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
        {account.warnings.length > 0 && (
          <p className="text-xs text-status-warning mt-0.5 truncate">
            {account.warnings[0]}
            {account.warnings.length > 1 && ` (+${account.warnings.length - 1})`}
          </p>
        )}
      </div>
      <div className="text-xs text-text-tertiary whitespace-nowrap">
        {lastActivity ? formatRelativeTime(lastActivity) : "—"}
      </div>
    </div>
  );
}

function ChannelCard({ channel }: { channel: ChannelInfo }) {
  const badge = channelStatusBadge(channel.status);
  const icon = CHANNEL_ICONS[channel.type] || "📡";

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
              {channel.accountCount > 1 && (
                <> · {channel.healthyCount} healthy</>
              )}
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
            <AccountRow key={account.accountId} account={account} />
          ))}
        </div>
      )}
    </Card>
  );
}

export function ChannelOverview() {
  const channels = useChannelStore((s) => s.channels);
  const loading = useChannelStore((s) => s.loading);
  const error = useChannelStore((s) => s.error);
  const fetchChannels = useChannelStore((s) => s.fetchChannels);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

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
            <ChannelCard key={channel.id} channel={channel} />
          ))}
        </div>
      )}
    </div>
  );
}
