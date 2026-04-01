import { createFileRoute } from "@tanstack/react-router";
import { ChannelOverview } from "@/components/channels/ChannelOverview";

export const Route = createFileRoute("/channels")({
  component: ChannelOverview,
});