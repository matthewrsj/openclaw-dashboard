import { useEffect, useState } from "react";
import { useCronStore } from "@/stores/cron";
import { useAgentStore } from "@/stores/agents";
import { useUIStore } from "@/stores/ui";
import { Table } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { cronToHuman } from "@/services/cron-expression";
import { formatRelativeTime } from "@/lib/format";
import type { CronJob } from "@/types/cron";

export function CronList() {
  const jobs = useCronStore((s) => s.jobList);
  const loading = useCronStore((s) => s.loading);
  const fetchJobs = useCronStore((s) => s.fetchJobs);
  const toggleJob = useCronStore((s) => s.toggleJob);
  const runJob = useCronStore((s) => s.runJob);
  const agents = useAgentStore((s) => s.agentList);
  const openModal = useUIStore((s) => s.openModal);
  const [agentFilter, setAgentFilter] = useState("all");

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const filtered = agentFilter === "all" ? jobs : jobs.filter((j) => j.agentId === agentFilter);

  const columns = [
    {
      key: "enabled", header: "", width: "48px",
      render: (job: CronJob) => (
        <button onClick={(e: React.MouseEvent) => { e.stopPropagation(); toggleJob(job.id, !job.enabled); }}
          className={`h-5 w-9 rounded-full transition-colors ${job.enabled ? "bg-accent-primary" : "bg-border-primary"}`}>
          <div className={`h-4 w-4 rounded-full bg-white transition-transform ${job.enabled ? "translate-x-4" : "translate-x-0.5"}`} />
        </button>
      ),
    },
    { key: "name", header: "Name", sortable: true, render: (job: CronJob) => <span className="font-medium">{job.name}</span> },
    { key: "agent", header: "Agent", render: (job: CronJob) => { const agent = agents.find((a) => a.id === job.agentId); return <span>{agent?.emoji || "🤖"} {agent?.name || job.agentId}</span>; } },
    { key: "schedule", header: "Schedule", render: (job: CronJob) => <span className="text-xs">{job.schedule.expr ? cronToHuman(job.schedule.expr) : job.schedule.at || "—"}</span> },
    {
      key: "lastRun", header: "Last Run", sortable: true,
      render: (job: CronJob) => (
        <span className="text-xs">
          {job.state.lastRunStatus && <span className={job.state.lastRunStatus === "ok" ? "text-status-success" : job.state.lastRunStatus === "error" ? "text-status-error" : "text-status-warning"}>{job.state.lastRunStatus === "ok" ? "✓" : job.state.lastRunStatus === "error" ? "✗" : "⏭"} </span>}
          {job.state.lastRunAtMs ? formatRelativeTime(job.state.lastRunAtMs) : "Never"}
        </span>
      ),
    },
    { key: "nextRun", header: "Next", render: (job: CronJob) => <span className="text-xs">{job.enabled && job.state.nextRunAtMs ? formatRelativeTime(job.state.nextRunAtMs) : "—"}</span> },
    { key: "actions", header: "", width: "80px", render: (job: CronJob) => <Button variant="ghost" size="sm" onClick={(e: React.MouseEvent) => { e.stopPropagation(); runJob(job.id); }}>Run Now</Button> },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-text-primary">Cron Jobs</h1>
        <div className="flex items-center gap-3">
          <Select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)}>
            <option value="all">All Agents</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.emoji} {a.name}</option>)}
          </Select>
          <Button size="sm" onClick={() => openModal({ type: "create-cron" })}>+ New</Button>
        </div>
      </div>
      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-md" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="⏰" title="No cron jobs" description="Create a cron job to automate agent tasks." action={{ label: "Create Cron Job", onClick: () => openModal({ type: "create-cron" }) }} />
      ) : (
        <Table columns={columns} data={filtered} keyExtractor={(j) => j.id} emptyMessage="No cron jobs match the filter" />
      )}
    </div>
  );
}
