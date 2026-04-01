import { createFileRoute } from "@tanstack/react-router";
import { CronList } from "@/components/cron/CronList";

export const Route = createFileRoute("/cron")({
  component: CronList,
});