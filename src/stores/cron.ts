/**
 * Cron job state store.
 *
 * Manages scheduled jobs, their run history, and real-time
 * updates from Gateway events.
 */

import { create } from "zustand";
import type { CronJob, CronRun } from "../types/cron";
import { gatewayRpc } from "../services/tauri-commands";
import { useUIStore } from "./ui";

interface CronStore {
  /** Map of job ID → CronJob. */
  jobs: Map<string, CronJob>;
  /** Map of job ID → run history. */
  runs: Map<string, CronRun[]>;
  /** Whether the initial fetch is in progress. */
  loading: boolean;

  // Actions
  fetchJobs: () => Promise<void>;
  toggleJob: (id: string, enabled: boolean) => Promise<void>;
  runJob: (id: string) => Promise<void>;
  deleteJob: (id: string) => Promise<void>;
  fetchRuns: (jobId: string, limit?: number) => Promise<void>;
  handleCronEvent: (
    eventType: string,
    data: Record<string, unknown>,
  ) => void;

  // Selectors
  getJob: (id: string) => CronJob | undefined;
  getJobList: () => CronJob[];
  getRunsForJob: (jobId: string) => CronRun[];
}

export const useCronStore = create<CronStore>((set, get) => ({
  jobs: new Map(),
  runs: new Map(),
  loading: false,

  fetchJobs: async () => {
    set({ loading: true });
    try {
      const result = await gatewayRpc<{ jobs: CronJob[] }>("cron.list");
      const jobMap = new Map<string, CronJob>();
      for (const job of result.jobs || []) {
        jobMap.set(job.id, job);
      }
      set({ jobs: jobMap, loading: false });
    } catch (err) {
      console.error("Failed to fetch cron jobs:", err);
      set({ loading: false });
    }
  },

  toggleJob: async (id: string, enabled: boolean) => {
    // Optimistic update
    const jobs = new Map(get().jobs);
    const prev = jobs.get(id);
    if (prev) {
      jobs.set(id, { ...prev, enabled });
      set({ jobs });
    }

    try {
      await gatewayRpc(enabled ? "cron.enable" : "cron.disable", { id });
    } catch {
      // Rollback
      if (prev) {
        const jobs = new Map(get().jobs);
        jobs.set(id, prev);
        set({ jobs });
      }
      useUIStore.getState().addToast({
        type: "error",
        message: `Failed to ${enabled ? "enable" : "disable"} job`,
      });
    }
  },

  runJob: async (id: string) => {
    try {
      await gatewayRpc("cron.run", { id });
      useUIStore.getState().addToast({
        type: "success",
        message: "Job triggered manually",
      });
    } catch (err) {
      useUIStore.getState().addToast({
        type: "error",
        message: `Failed to run job: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  },

  deleteJob: async (id: string) => {
    try {
      await gatewayRpc("cron.rm", { id });
      const jobs = new Map(get().jobs);
      jobs.delete(id);
      set({ jobs });
    } catch (err) {
      useUIStore.getState().addToast({
        type: "error",
        message: `Failed to delete job: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  },

  fetchRuns: async (jobId: string, limit = 20) => {
    try {
      const result = await gatewayRpc<{ runs: CronRun[] }>("cron.runs", {
        id: jobId,
        limit,
      });
      const runs = new Map(get().runs);
      runs.set(jobId, result.runs || []);
      set({ runs });
    } catch (err) {
      console.error("Failed to fetch cron runs:", err);
    }
  },

  handleCronEvent: (
    eventType: string,
    data: Record<string, unknown>,
  ) => {
    const jobId = data.jobId as string;
    if (!jobId) return;

    if (eventType === "cron.run.started") {
      const runs = new Map(get().runs);
      const jobRuns = [...(runs.get(jobId) || [])];
      jobRuns.unshift({
        runId: (data.runId as string) || "",
        jobId,
        trigger: (data.trigger as "scheduled" | "manual") || "scheduled",
        startedAt: Date.now(),
        endedAt: null,
        durationMs: 0,
        status: "running",
        output: null,
        error: null,
      });
      runs.set(jobId, jobRuns);
      set({ runs });
    } else if (eventType === "cron.run.completed") {
      const runs = new Map(get().runs);
      const jobRuns = [...(runs.get(jobId) || [])];
      const runId = data.runId as string;
      const idx = jobRuns.findIndex((r) => r.runId === runId);
      if (idx >= 0) {
        jobRuns[idx] = {
          ...jobRuns[idx],
          status: (data.status as CronRun["status"]) || "ok",
          endedAt: Date.now(),
          durationMs: (data.durationMs as number) || 0,
        };
        runs.set(jobId, jobRuns);
        set({ runs });
      }
    }
  },

  getJob: (id: string) => get().jobs.get(id),
  getJobList: () => Array.from(get().jobs.values()),
  getRunsForJob: (jobId: string) => get().runs.get(jobId) || [],
}));
