import { useEffect } from "react";
import { useChannelStore } from "@/stores/channels";
import { Table } from "@/components/ui/Table";
import { StatusDot } from "@/components/ui/StatusDot";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatRelativeTime } from "@/lib/format";
import type { ChannelInfo } from "@/types/channel";

const CHANNEL_ICONS: Record<string, string> = { webchat: "💬", telegram: "📱", discord: "💬", whatsapp: "📱", slack: "💬", signal: "📱" };

export function ChannelOverview() {
  const channels = useChannelStore((s) => s.channels);
  const loading = useChannelStore((s) => s.loading);
  const error = useChannelStore((s) => s.error);
  const fetchChannels = useChannelStore((s) => s.fetchChannels);

  useEffect(() => { fetchChannels(); }, [fetchChannels]);

  const columns = [
    { key: "channel", header: "Channel", render: (ch: ChannelInfo) => <div className="flex items-center gap-2"><span>{CHANNEL_ICONS[ch.type] || "📡"}</span><span className="capitalize">{ch.type}</span></div> },
    { key: "status", header: "Status", render: (ch: ChannelInfo) => <div className="flex items-center gap-2"><StatusDot status={ch.status === "connected" ? "success" : ch.status === "error" ? "error" : "inactive"} size="sm" /><Badge variant={ch.status === "connected" ? "success" : ch.status === "error" ? "error" : "secondary"}>{ch.status}</Badge></div> },
    { key: "agent", header: "Agent", render: (ch: ChannelInfo) => ch.agentId ? <span>{ch.agentEmoji} {ch.agentName || ch.agentId}</span> : <span className="text-text-tertiary">—</span> },
    { key: "lastMessage", header: "Last Message", render: (ch: ChannelInfo) => <span className="text-xs">{ch.lastMessageAt ? formatRelativeTime(ch.lastMessageAt) : "—"}</span> },
    { key: "error", header: "Error", render: (ch: ChannelInfo) => ch.error ? <span className="text-xs text-status-error">{ch.error}</span> : null },
  ];

  if (error) return <EmptyState icon="⚠️" title="Failed to load channels" description={error} action={{ label: "Retry", onClick: fetchChannels }} />;

  return (
    <div className="p-6">
      <h1 className="mb-6 text-xl font-semibold text-text-primary">Channels</h1>
      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-md" />)}</div>
      ) : channels.length === 0 ? (
        <EmptyState icon="📡" title="No channels configured" description="Configure channels in the OpenClaw CLI." />
      ) : (
        <Table columns={columns} data={channels} keyExtractor={(ch) => ch.id} />
      )}
    </div>
  );
}
