import { useEffect } from "react";
import { useCronStore } from "@/stores/cron";
import { useAgentStore } from "@/stores/agents";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Table } from "@/components/ui/Table";
import { cronToHuman } from "@/services/cron-expression";
import { formatRelativeTime, formatDuration } from "@/lib/format";
import type { CronRun } from "@/types/cron";

interface CronDetailProps { jobId: string; }

export function CronDetail({ jobId }: CronDetailProps) {
  const job = useCronStore((s) => s.jobs.get(jobId));
  const runs = useCronStore((s) => s.runs.get(jobId) || []);
  const fetchRuns = useCronStore((s) => s.fetchRuns);
  const runJob = useCronStore((s) => s.runJob);
  const agent = useAgentStore((s) => (job ? s.agents.get(job.agentId) : undefined));

  useEffect(() => { fetchRuns(jobId); }, [jobId, fetchRuns]);

  if (!job) return <p className="p-6 text-text-tertiary">Job not found</p>;

  const runColumns = [
    { key: "time", header: "Time", render: (r: CronRun) => <span className="text-xs">{formatRelativeTime(r.startedAt)}</span> },
    { key: "duration", header: "Duration", render: (r: CronRun) => <span className="text-xs tabular-nums">{formatDuration(r.durationMs)}</span> },
    { key: "status", header: "Status", render: (r: CronRun) => <Badge variant={r.status === "ok" ? "success" : r.status === "error" ? "error" : r.status === "running" ? "default" : "warning"}>{r.status}</Badge> },
    { key: "trigger", header: "Trigger", render: (r: CronRun) => <span className="text-xs">{r.trigger}</span> },
  ];

  return (
    <div className="space-y-4 p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{job.name}</CardTitle>
            <Button size="sm" onClick={() => runJob(job.id)}>Run Now</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-text-secondary">Agent</span><span>{agent?.emoji} {agent?.name || job.agentId}</span></div>
            <div className="flex justify-between"><span className="text-text-secondary">Schedule</span><span>{job.schedule.expr ? cronToHuman(job.schedule.expr) : job.schedule.at || "—"}</span></div>
            <div className="flex justify-between"><span className="text-text-secondary">Task</span><span className="max-w-xs truncate text-right">{job.payload.message || job.payload.text || "—"}</span></div>
            <div className="flex justify-between"><span className="text-text-secondary">Status</span><Badge variant={job.enabled ? "success" : "secondary"}>{job.enabled ? "Enabled" : "Disabled"}</Badge></div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">Run History</CardTitle></CardHeader>
        <CardContent><Table columns={runColumns} data={runs} keyExtractor={(r) => r.runId} emptyMessage="No runs yet" /></CardContent>
      </Card>
    </div>
  );
}
