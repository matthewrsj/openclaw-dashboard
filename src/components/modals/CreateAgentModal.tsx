import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { useUIStore } from "@/stores/ui";
import { useAgentStore } from "@/stores/agents";
import { execCli } from "@/services/tauri-commands";

interface CreateAgentModalProps { open: boolean; onClose: () => void; }

export function CreateAgentModal({ open, onClose }: CreateAgentModalProps) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🤖");
  const [workspace, setWorkspace] = useState("");
  const [model, setModel] = useState("claude-opus-4-6");
  const [soul, setSoul] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const addToast = useUIStore((s) => s.addToast);
  const fetchAgents = useAgentStore((s) => s.fetchAgents);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Name is required";
    if (!workspace.trim()) errs.workspace = "Workspace path is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const args = ["agents", "add", "--name", name.trim(), "--workspace", workspace.trim(), "--emoji", emoji];
      const result = await execCli(args);
      if (result.exitCode !== 0) throw new Error(result.stderr || "Failed to create agent");
      addToast({ type: "success", message: `Agent "${name}" created` });
      await fetchAgents();
      onClose();
    } catch (err) {
      addToast({ type: "error", message: err instanceof Error ? err.message : String(err) });
    } finally { setSubmitting(false); }
  };

  if (!open) return null;

  return (
    <Modal onClose={onClose} title="Create New Agent"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={handleSubmit} disabled={submitting}>{submitting ? "Creating…" : "Create Agent"}</Button></>}>
      <div className="space-y-4">
        <Input id="new-agent-name" label="Name *" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} placeholder="e.g., Brokkr" />
        <Input id="new-agent-emoji" label="Emoji" value={emoji} onChange={(e) => setEmoji(e.target.value)} className="w-20" />
        <Input id="new-agent-workspace" label="Workspace Path *" value={workspace} onChange={(e) => setWorkspace(e.target.value)} error={errors.workspace} placeholder="/Users/…/.openclaw/workspace-…" />
        <Select id="new-agent-model" label="Default Model" value={model} onChange={(e) => setModel(e.target.value)}>
          <option value="claude-opus-4-6">claude-opus-4-6</option>
          <option value="claude-sonnet-4-20250514">claude-sonnet-4-20250514</option>
          <option value="gpt-4o">gpt-4o</option>
        </Select>
        <Textarea id="new-agent-soul" label="Identity / SOUL" value={soul} onChange={(e) => setSoul(e.target.value)} placeholder="Describe this agent's persona…" rows={4} />
      </div>
    </Modal>
  );
}