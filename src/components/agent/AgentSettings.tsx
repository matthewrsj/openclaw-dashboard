import { useState } from "react";
import type { Agent } from "@/types/agent";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useUIStore } from "@/stores/ui";

interface AgentSettingsProps { agent: Agent; }

export function AgentSettings({ agent }: AgentSettingsProps) {
  const [name, setName] = useState(agent.name);
  const [emoji, setEmoji] = useState(agent.emoji);
  const [model, setModel] = useState(agent.model);
  const [saving, setSaving] = useState(false);
  const addToast = useUIStore((s) => s.addToast);
  const openModal = useUIStore((s) => s.openModal);
  const isDirty = name !== agent.name || emoji !== agent.emoji || model !== agent.model;

  const handleSave = async () => {
    setSaving(true);
    try {
      addToast({ type: "success", message: "Settings saved" });
    } catch (err) {
      addToast({ type: "error", message: `Failed to save: ${err instanceof Error ? err.message : String(err)}` });
    } finally { setSaving(false); }
  };

  return (
    <div className="max-w-2xl space-y-8 p-6">
      <section>
        <h3 className="mb-4 text-sm font-semibold text-text-primary">Identity</h3>
        <div className="space-y-4">
          <Input id="agent-name" label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input id="agent-emoji" label="Emoji" value={emoji} onChange={(e) => setEmoji(e.target.value)} className="w-20" />
        </div>
      </section>
      <section>
        <h3 className="mb-4 text-sm font-semibold text-text-primary">Model</h3>
        <Select id="agent-model" label="Default Model" value={model} onChange={(e) => setModel(e.target.value)}>
          <option value={agent.model}>{agent.model}</option>
        </Select>
      </section>
      <section>
        <h3 className="mb-4 text-sm font-semibold text-text-primary">Workspace</h3>
        <Input id="agent-workspace" label="Workspace Path" value={agent.workspace} disabled />
      </section>
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={!isDirty || saving}>{saving ? "Saving…" : "Save"}</Button>
      </div>
      <section className="rounded-lg border border-status-error/30 p-4">
        <h3 className="mb-2 text-sm font-semibold text-status-error">Danger Zone</h3>
        <p className="mb-3 text-xs text-text-secondary">Deleting this agent will remove all configuration and terminate active sessions.</p>
        <Button variant="danger" size="sm" onClick={() => openModal({ type: "delete-agent", props: { agentId: agent.id, agentName: agent.name } })}>Delete Agent</Button>
      </section>
    </div>
  );
}
