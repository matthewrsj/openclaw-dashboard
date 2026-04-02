import { useState, useMemo } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useAgentStore } from "@/stores/agents";
import { useUIStore } from "@/stores/ui";
import { gatewayRpc } from "@/services/tauri-commands";
import { useCronStore } from "@/stores/cron";
import { cronToHuman } from "@/services/cron-expression";
import type { CronJob } from "@/types/cron";

/** Common schedule presets with human labels and cron expressions. */
const PRESETS = [
  { label: "Every 5 minutes", expr: "*/5 * * * *" },
  { label: "Every 15 minutes", expr: "*/15 * * * *" },
  { label: "Every 30 minutes", expr: "*/30 * * * *" },
  { label: "Every hour", expr: "0 * * * *" },
  { label: "Every 2 hours", expr: "0 */2 * * *" },
  { label: "Every 4 hours", expr: "0 */4 * * *" },
  { label: "Daily at 9am", expr: "0 9 * * *" },
  { label: "Daily at noon", expr: "0 12 * * *" },
  { label: "Daily at 6pm", expr: "0 18 * * *" },
  { label: "Twice daily (9am & 5pm)", expr: "0 9,17 * * *" },
  { label: "Three times daily (8am, noon, 6pm)", expr: "0 8,12,18 * * *" },
  { label: "Weekdays at 9am", expr: "0 9 * * 1-5" },
  { label: "Monday at 9am", expr: "0 9 * * 1" },
  { label: "Weekly on Sunday", expr: "0 10 * * 0" },
  { label: "First of every month", expr: "0 9 1 * *" },
  { label: "Custom…", expr: "" },
];

interface CronFormProps {
  open: boolean;
  onClose: () => void;
  /** Pass an existing job to edit. Omit for create mode. */
  editJob?: CronJob;
}

export function CronForm({ open, onClose, editJob }: CronFormProps) {
  const agents = useAgentStore((s) => s.agentList);
  const fetchJobs = useCronStore((s) => s.fetchJobs);
  const updateJob = useCronStore((s) => s.updateJob);
  const addToast = useUIStore((s) => s.addToast);

  const isEdit = !!editJob;

  const [agentId, setAgentId] = useState(editJob?.agentId || agents[0]?.id || "");
  const [name, setName] = useState(editJob?.name || "");
  const [presetIdx, setPresetIdx] = useState(() => {
    if (editJob?.schedule.expr) {
      const idx = PRESETS.findIndex((p) => p.expr === editJob.schedule.expr);
      return idx >= 0 ? idx : PRESETS.length - 1; // Custom
    }
    return 0;
  });
  const [customExpr, setCustomExpr] = useState(editJob?.schedule.expr || "");
  const [message, setMessage] = useState(
    editJob?.payload.message || editJob?.payload.text || "",
  );
  const [enabled, setEnabled] = useState(editJob?.enabled ?? true);
  const [submitting, setSubmitting] = useState(false);

  const isCustom = presetIdx === PRESETS.length - 1;
  const cronExpr = isCustom ? customExpr : PRESETS[presetIdx].expr;

  const schedulePreview = useMemo(() => {
    if (!cronExpr) return "";
    try { return cronToHuman(cronExpr); } catch { return ""; }
  }, [cronExpr]);

  const isValid = agentId && name.trim() && cronExpr.trim() && message.trim();

  const handleSubmit = async () => {
    if (!isValid) return;
    setSubmitting(true);
    try {
      if (isEdit && editJob) {
        await updateJob(editJob.id, {
          name: name.trim(),
          schedule: { kind: "cron", expr: cronExpr.trim(), tz: "America/Los_Angeles" },
          payload: { kind: "agentTurn", message: message.trim() },
          enabled,
        });
      } else {
        await gatewayRpc("cron.add", {
          agentId,
          name: name.trim(),
          schedule: { kind: "cron", expr: cronExpr.trim(), tz: "America/Los_Angeles" },
          payload: { kind: "agentTurn", message: message.trim() },
          enabled,
        });
        addToast({ type: "success", message: "Cron job created" });
        await fetchJobs();
      }
      onClose();
    } catch (err) {
      addToast({
        type: "error",
        message: `Failed to ${isEdit ? "update" : "create"} job: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <Modal
      onClose={onClose}
      title={isEdit ? "Edit Cron Job" : "New Cron Job"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!isValid || submitting}>
            {submitting ? (isEdit ? "Saving…" : "Creating…") : isEdit ? "Save" : "Create Job"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          id="cron-agent"
          label="Agent"
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          disabled={isEdit}
        >
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.emoji} {a.name}
            </option>
          ))}
        </Select>

        <Input
          id="cron-name"
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., daily-digest"
        />

        {/* Schedule builder */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-text-secondary">
            Schedule
          </label>
          <div className="grid grid-cols-2 gap-1.5 mb-2">
            {PRESETS.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setPresetIdx(idx)}
                className={`rounded-md border px-2.5 py-1.5 text-xs text-left transition-colors ${
                  presetIdx === idx
                    ? "border-accent-primary bg-accent-primary/10 text-accent-primary"
                    : "border-border-primary text-text-secondary hover:bg-bg-hover"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {isCustom && (
            <Input
              id="cron-custom-expr"
              value={customExpr}
              onChange={(e) => setCustomExpr(e.target.value)}
              placeholder="0 9 * * *"
            />
          )}

          {schedulePreview && (
            <p className="mt-1.5 text-xs text-text-tertiary">→ {schedulePreview}</p>
          )}
        </div>

        <Textarea
          id="cron-message"
          label="Task / Prompt"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="What should the agent do?"
          rows={3}
        />

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-border-primary"
          />
          Enabled
        </label>
      </div>
    </Modal>
  );
}
