import { describe, it, expect, vi, beforeEach } from "vitest";
import { useCronStore } from "@/stores/cron";
import { createMockCronJob, createMockCronRun } from "../helpers/mock-data";

// Mock tauri-commands
vi.mock("@/services/tauri-commands", () => ({
  gatewayRpc: vi.fn(),
}));

// Mock UI store for toast notifications
vi.mock("@/stores/ui", () => ({
  useUIStore: {
    getState: () => ({
      addToast: vi.fn(),
    }),
  },
}));

describe("CronStore", () => {
  beforeEach(() => {
    useCronStore.setState({
      jobs: new Map(),
      runs: new Map(),
      loading: false,
    });
    vi.clearAllMocks();
  });

  describe("fetchJobs", () => {
    it("populates jobs from RPC response", async () => {
      const { gatewayRpc } = await import("@/services/tauri-commands");
      const job1 = createMockCronJob({ id: "job-1", name: "Daily Digest" });
      const job2 = createMockCronJob({ id: "job-2", name: "Weekly Report" });
      (gatewayRpc as ReturnType<typeof vi.fn>).mockResolvedValue({ jobs: [job1, job2] });

      await useCronStore.getState().fetchJobs();
      expect(useCronStore.getState().jobs.size).toBe(2);
      expect(useCronStore.getState().getJob("job-1")?.name).toBe("Daily Digest");
      expect(useCronStore.getState().loading).toBe(false);
    });

    it("handles fetch error", async () => {
      const { gatewayRpc } = await import("@/services/tauri-commands");
      (gatewayRpc as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("RPC failed"));

      await useCronStore.getState().fetchJobs();
      expect(useCronStore.getState().loading).toBe(false);
    });
  });

  describe("toggleJob", () => {
    it("optimistically updates job enabled state", async () => {
      const job = createMockCronJob({ id: "job-1", enabled: true });
      useCronStore.setState({ jobs: new Map([["job-1", job]]) });

      const { gatewayRpc } = await import("@/services/tauri-commands");
      (gatewayRpc as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });

      await useCronStore.getState().toggleJob("job-1", false);
      expect(useCronStore.getState().getJob("job-1")?.enabled).toBe(false);
    });

    it("rolls back on failure", async () => {
      const job = createMockCronJob({ id: "job-1", enabled: true });
      useCronStore.setState({ jobs: new Map([["job-1", job]]) });

      const { gatewayRpc } = await import("@/services/tauri-commands");
      (gatewayRpc as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Fail"));

      await useCronStore.getState().toggleJob("job-1", false);
      expect(useCronStore.getState().getJob("job-1")?.enabled).toBe(true); // rolled back
    });
  });

  describe("deleteJob", () => {
    it("removes job from store on success", async () => {
      const job = createMockCronJob({ id: "job-1" });
      useCronStore.setState({ jobs: new Map([["job-1", job]]) });

      const { gatewayRpc } = await import("@/services/tauri-commands");
      (gatewayRpc as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });

      await useCronStore.getState().deleteJob("job-1");
      expect(useCronStore.getState().jobs.size).toBe(0);
    });

    it("keeps job on delete failure", async () => {
      const job = createMockCronJob({ id: "job-1" });
      useCronStore.setState({ jobs: new Map([["job-1", job]]) });

      const { gatewayRpc } = await import("@/services/tauri-commands");
      (gatewayRpc as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Fail"));

      await useCronStore.getState().deleteJob("job-1");
      expect(useCronStore.getState().jobs.size).toBe(1);
    });
  });

  describe("fetchRuns", () => {
    it("populates run history for a job", async () => {
      const { gatewayRpc } = await import("@/services/tauri-commands");
      const runs = [
        createMockCronRun({ runId: "r1", status: "ok" }),
        createMockCronRun({ runId: "r2", status: "error" }),
      ];
      (gatewayRpc as ReturnType<typeof vi.fn>).mockResolvedValue({ runs });

      await useCronStore.getState().fetchRuns("job-1");
      expect(useCronStore.getState().getRunsForJob("job-1")).toHaveLength(2);
    });
  });

  describe("handleCronEvent", () => {
    it("adds running entry on cron.run.started", () => {
      useCronStore.getState().handleCronEvent("cron.run.started", {
        jobId: "job-1",
        runId: "run-1",
        trigger: "scheduled",
      });

      const runs = useCronStore.getState().getRunsForJob("job-1");
      expect(runs).toHaveLength(1);
      expect(runs[0].status).toBe("running");
      expect(runs[0].trigger).toBe("scheduled");
    });

    it("updates run status on cron.run.completed", () => {
      // Pre-populate with a running entry
      useCronStore.setState({
        runs: new Map([
          ["job-1", [createMockCronRun({ runId: "run-1", status: "running" })]],
        ]),
      });

      useCronStore.getState().handleCronEvent("cron.run.completed", {
        jobId: "job-1",
        runId: "run-1",
        status: "ok",
        durationMs: 5000,
      });

      const runs = useCronStore.getState().getRunsForJob("job-1");
      expect(runs[0].status).toBe("ok");
      expect(runs[0].durationMs).toBe(5000);
    });

    it("ignores events without jobId", () => {
      useCronStore.getState().handleCronEvent("cron.run.started", {});
      expect(useCronStore.getState().runs.size).toBe(0);
    });
  });

  describe("selectors", () => {
    it("getJobList returns all jobs as array", () => {
      const jobs = new Map([
        ["j1", createMockCronJob({ id: "j1" })],
        ["j2", createMockCronJob({ id: "j2" })],
      ]);
      useCronStore.setState({ jobs });
      expect(useCronStore.getState().getJobList()).toHaveLength(2);
    });

    it("getRunsForJob returns empty array for unknown job", () => {
      expect(useCronStore.getState().getRunsForJob("nonexistent")).toEqual([]);
    });
  });
});
