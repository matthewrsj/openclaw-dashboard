/** A scheduled cron job. */
export interface CronJob {
  /** Job UUID. */
  id: string;
  /** Agent this job belongs to. */
  agentId: string;
  /** Human-readable job name. */
  name: string;
  /** Whether the job is enabled. */
  enabled: boolean;
  /** Schedule configuration. */
  schedule: {
    kind: "cron";
    /** Cron expression (e.g., "0 8,12,17 * * *"). */
    expr: string;
    /** Timezone (e.g., "America/Los_Angeles"). */
    tz: string;
  };
  /** Job payload. */
  payload: {
    kind: "agentTurn";
    /** Task prompt sent to the agent. */
    message: string;
    /** Timeout in seconds. */
    timeoutSeconds?: number;
  };
  /** Override model for this job, or null for agent default. */
  modelOverride: string | null;
  /** Creation timestamp (Unix ms). */
  createdAt: number;
  /** Last update timestamp (Unix ms). */
  updatedAt: number;
  /** Runtime state. */
  state: {
    nextRunAtMs: number | null;
    lastRunAtMs: number | null;
    lastRunStatus: "ok" | "error" | "skipped" | null;
    lastDurationMs: number | null;
    consecutiveErrors: number;
    lastError: string | null;
  };
}

/** A single execution of a cron job. */
export interface CronRun {
  runId: string;
  jobId: string;
  trigger: "scheduled" | "manual";
  startedAt: number;
  endedAt: number | null;
  durationMs: number;
  status: "running" | "ok" | "error" | "skipped";
  output: string | null;
  error: string | null;
}
