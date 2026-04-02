import { useState, useCallback } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { useUIStore } from "@/stores/ui";
import { useAgentStore } from "@/stores/agents";
import { execCli } from "@/services/tauri-commands";

/** Base path for agent workspaces. */
const WORKSPACE_BASE = "~/.openclaw/workspace";

/** Derive a default workspace path from the agent name. */
function defaultWorkspace(agentName: string): string {
  const slug = agentName.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return slug ? `${WORKSPACE_BASE}-${slug}` : "";
}

/** Curated emoji pool — personality-forward, avoids generic/overused ones. */
const AGENT_EMOJIS = [
  "🦊", "🐙", "🦉", "🐋", "🦅", "🐺", "🦈", "🐬",
  "🦇", "🐝", "🦎", "🐢", "🦜", "🐧", "🦩", "🦚",
  "🔮", "⚗️", "🧿", "🗿", "⚒️", "🛡️", "🔱", "⚙️",
  "🧠", "👁️", "💎", "🌀", "⚡", "🌙", "☄️", "🪐",
  "🎭", "🃏", "🏴‍☠️", "🧬", "🦾", "🤖", "👾", "🕵️",
];

function pickRandomEmoji(exclude?: string): string {
  const pool = exclude ? AGENT_EMOJIS.filter((e) => e !== exclude) : AGENT_EMOJIS;
  return pool[Math.floor(Math.random() * pool.length)];
}

interface CreateAgentModalProps { open: boolean; onClose: () => void; }

export function CreateAgentModal({ open, onClose }: CreateAgentModalProps) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(() => pickRandomEmoji());
  const [workspace, setWorkspace] = useState("");
  const [workspaceManual, setWorkspaceManual] = useState(false);
  const [model, setModel] = useState("claude-opus-4-6");
  const [soul, setSoul] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const addToast = useUIStore((s) => s.addToast);
  const fetchAgents = useAgentStore((s) => s.fetchAgents);

  const shuffleEmoji = useCallback(() => {
    setEmoji((prev) => pickRandomEmoji(prev));
  }, []);

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
      if (result === null) throw new Error("Not running inside Tauri");
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
        <Input id="new-agent-name" label="Name *" value={name} onChange={(e) => {
          setName(e.target.value);
          if (!workspaceManual) setWorkspace(defaultWorkspace(e.target.value));
        }} error={errors.name} placeholder="e.g., Brokkr" />

        {/* Emoji picker — random auto-select with shuffle */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-text-secondary">
            Emoji
          </label>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] text-2xl">
              {emoji}
            </div>
            <Button variant="secondary" size="sm" onClick={shuffleEmoji} type="button">
              🎲 Shuffle
            </Button>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="new-agent-workspace" className="text-sm font-medium text-text-secondary">
              Workspace Path *
            </label>
            {!workspaceManual && workspace && (
              <button
                type="button"
                className="text-xs text-accent-primary hover:underline"
                onClick={() => setWorkspaceManual(true)}
              >
                Edit
              </button>
            )}
          </div>
          {workspaceManual ? (
            <Input id="new-agent-workspace" value={workspace} onChange={(e) => setWorkspace(e.target.value)} error={errors.workspace} placeholder="~/.openclaw/workspace-myagent" />
          ) : (
            <div className="flex h-9 items-center rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-3 text-sm text-text-secondary">
              {workspace || <span className="text-text-tertiary">Auto-generated from name</span>}
            </div>
          )}
          {errors.workspace && !workspaceManual && (
            <p className="mt-1 text-xs text-status-error">{errors.workspace}</p>
          )}
        </div>
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
