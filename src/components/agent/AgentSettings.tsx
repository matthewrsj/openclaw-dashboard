import { useState } from "react";
import type { Agent } from "@/types/agent";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useUIStore } from "@/stores/ui";
import { useAgentStore } from "@/stores/agents";
import { execCli } from "@/services/tauri-commands";

interface AgentSettingsProps { agent: Agent; }

export function AgentSettings({ agent }: AgentSettingsProps) {
  const [name, setName] = useState(agent.name);
  const [emoji, setEmoji] = useState(agent.emoji);
  const [model, setModel] = useState(agent.model);
  const [saving, setSaving] = useState(false);
  const addToast = useUIStore((s) => s.addToast);
  const openModal = useUIStore((s) => s.openModal);
  const fetchAgents = useAgentStore((s) => s.fetchAgents);

  const identityDirty = name !== agent.name || emoji !== agent.emoji;
  const isDirty = identityDirty || model !== agent.model;

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update identity (name + emoji) via set-identity
      if (identityDirty) {
        const args = ["agents", "set-identity", agent.id];
        if (name !== agent.name) args.push("--name", name);
        if (emoji !== agent.emoji) args.push("--emoji", emoji);
        const result = await execCli(args);
        if (result && result.exitCode !== 0) {
          throw new Error(result.stderr || "Failed to update identity");
        }
      }

      // Refresh agent list to pick up changes
      await fetchAgents();
      addToast({ type: "success", message: "Settings saved" });
    } catch (err) {
      addToast({ type: "error", message: `Failed to save: ${err instanceof Error ? err.message : String(err)}` });
    } finally { setSaving(false); }
  };

  return (
    <div className="max-w-2xl space-y-8 p-6">
      <section>
        <h3 className="mb-4 text-sm font-semibold text-text-primary">Identity</h3>
        <p className="mb-3 text-xs text-text-secondary">
          Changes the display name and emoji. The agent ID ({agent.id}) cannot be changed.
        </p>
        <div className="space-y-4">
          <Input id="agent-name" label="Display Name" value={name} onChange={(e) => setName(e.target.value)} />
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
        <h3 className="mb-4 text-sm font-semibold text-text-primary">Info</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-text-secondary">Agent ID</span>
            <span className="font-mono text-xs">{agent.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">Workspace</span>
            <span className="font-mono text-xs truncate max-w-xs">{agent.workspace}</span>
          </div>
        </div>
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
