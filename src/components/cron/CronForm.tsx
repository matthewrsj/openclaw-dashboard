import { useState } from "react";
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

interface CronFormProps { open: boolean; onClose: () => void; }

export function CronForm({ open, onClose }: CronFormProps) {
  const agents = useAgentStore((s) => s.getAgentList());
  const fetchJobs = useCronStore((s) => s.fetchJobs);
  const addToast = useUIStore((s) => s.addToast);
  const [agentId, setAgentId] = useState(agents[0]?.id || "");
  const [name, setName] = useState("");
  const [schedule, setSchedule] = useState("");
  const [message, setMessage] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const schedulePreview = schedule ? cronToHuman(schedule) : "";
  const isValid = agentId && name.trim() && schedule.trim() && message.trim();

  const handleSubmit = async () => {
    if (!isValid) return;
    setSubmitting(true);
    try {
      await gatewayRpc("cron.add", { agentId, name: name.trim(), schedule: { kind: "cron", expr: schedule.trim(), tz: "America/Los_Angeles" }, payload: { kind: "agentTurn", message: message.trim() }, enabled });
      addToast({ type: "success", message: "Cron job created" });
      await fetchJobs();
      onClose();
    } catch (err) {
      addToast({ type: "error", message: `Failed to create job: ${err instanceof Error ? err.message : String(err)}` });
    } finally { setSubmitting(false); }
  };

  if (!open) return null;

  return (
    <Modal
      onClose={onClose} title="New Cron Job"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={handleSubmit} disabled={!isValid || submitting}>{submitting ? "Creating…" : "Create Job"}</Button></>}
    >
      <div className="space-y-4">
        <Select id="cron-agent" label="Agent" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
          {agents.map((a) => <option key={a.id} value={a.id}>{a.emoji} {a.name}</option>)}
        </Select>
        <Input id="cron-name" label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., daily-digest" />
        <div>
          <Input id="cron-schedule" label="Schedule (cron expression)" value={schedule} onChange={(e) => setSchedule(e.target.value)} placeholder="0 9 * * *" />
          {schedulePreview && <p className="mt-1 text-xs text-text-secondary">→ {schedulePreview}</p>}
        </div>
        <Textarea id="cron-message" label="Task / Prompt" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What should the agent do?" rows={3} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4 rounded border-border-primary" />
          Enabled
        </label>
      </div>
    </Modal>
  );
}
