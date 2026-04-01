import { createFileRoute } from "@tanstack/react-router";
import { FleetOverview } from "@/components/fleet/FleetOverview";

export const Route = createFileRoute("/")({
  component: FleetOverview,
});