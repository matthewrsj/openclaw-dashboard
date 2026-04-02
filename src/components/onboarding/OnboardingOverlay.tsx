/**
 * Onboarding overlay for first-run setup.
 *
 * A two-step flow guiding new users through gateway connection
 * and initial agent creation.
 */

import { useState, useCallback, useEffect } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useGatewayStore } from "@/stores/gateway";
import { useSettingsStore } from "@/stores/settings";
import { useAgentStore } from "@/stores/agents";
import { useModelStore } from "@/stores/models";
import { useUIStore } from "@/stores/ui";
import {
  setToken,
  execCli,
  writeWorkspaceFile,
} from "@/services/tauri-commands";

/** Base path for agent workspaces. */
const WORKSPACE_BASE = "~/.openclaw/workspace";

/** Derive a default workspace path from the agent name. */
function defaultWorkspace(agentName: string): string {
  const slug = agentName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return slug ? `${WORKSPACE_BASE}-${slug}` : "";
}

interface OnboardingOverlayProps {
  onComplete: () => void;
}

export function OnboardingOverlay({
  onComplete,
}: OnboardingOverlayProps) {
  const [step, setStep] = useState<1 | 2>(1);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" />

      {/* Card */}
      <div className="relative w-full max-w-lg rounded-lg bg-bg-primary shadow-lg">
        {/* Step indicator */}
        <div
          className={
            "flex items-center justify-between border-b"
            + " border-border-primary px-6 py-4"
          }
        >
          <h2 className="text-lg font-semibold text-text-primary">
            {step === 1
              ? "Connect to Gateway"
              : "Create Your First Agent"}
          </h2>
          <span className="text-sm text-text-tertiary">
            Step {step} of 2
          </span>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 1 ? (
            <GatewayStep
              onConnected={() => setStep(2)}
              onSkip={onComplete}
            />
          ) : (
            <AgentStep onComplete={onComplete} onSkip={onComplete} />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1: Gateway connection
// ---------------------------------------------------------------------------

interface GatewayStepProps {
  onConnected: () => void;
  onSkip: () => void;
}

function GatewayStep({ onConnected, onSkip }: GatewayStepProps) {
  const storedUrl = useSettingsStore((s) => s.gatewayUrl);
  const setGatewayUrl = useSettingsStore((s) => s.setGatewayUrl);
  const connect = useGatewayStore((s) => s.connect);
  const connectionState = useGatewayStore((s) => s.connectionState);
  const lastError = useGatewayStore((s) => s.lastError);
  const fetchModels = useModelStore((s) => s.fetchModels);

  const [url, setUrl] = useState(storedUrl);
  const [tokenValue, setTokenValue] = useState("");
  const [connecting, setConnecting] = useState(false);

  // Auto-advance when connection succeeds
  useEffect(() => {
    if (connecting && connectionState === "connected") {
      setConnecting(false);
      fetchModels().catch(console.warn);
      onConnected();
    }
  }, [connectionState, connecting, onConnected, fetchModels]);

  const handleConnect = useCallback(async () => {
    if (!url.trim() || !tokenValue.trim()) return;
    setConnecting(true);
    try {
      await setToken(tokenValue.trim());
      setGatewayUrl(url.trim());
      await connect(url.trim(), tokenValue.trim());
    } catch (err) {
      setConnecting(false);
      console.warn("Onboarding connect failed:", err);
    }
  }, [url, tokenValue, setGatewayUrl, connect]);

  const isConnecting =
    connecting ||
    connectionState === "connecting" ||
    connectionState === "reconnecting";

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-secondary">
        Enter the URL and token for your OpenClaw Gateway to get
        started.
      </p>

      <Input
        id="onboarding-gw-url"
        label="Gateway URL"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="ws://localhost:18789"
        disabled={isConnecting}
      />

      <Input
        id="onboarding-gw-token"
        label="Bearer Token"
        type="password"
        value={tokenValue}
        onChange={(e) => setTokenValue(e.target.value)}
        placeholder="Paste your gateway token"
        disabled={isConnecting}
      />

      {lastError && (
        <p className="text-xs text-status-error">{lastError}</p>
      )}

      <p className="text-xs text-text-tertiary">
        The token will be stored securely in your macOS Keychain.
      </p>

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          className={
            "text-sm text-text-tertiary underline"
            + " hover:text-text-secondary"
          }
          onClick={onSkip}
        >
          Skip Setup
        </button>
        <Button
          onClick={handleConnect}
          disabled={
            !url.trim() || !tokenValue.trim() || isConnecting
          }
        >
          {isConnecting ? "Connecting..." : "Connect"}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2: Create first agent
// ---------------------------------------------------------------------------

interface AgentStepProps {
  onComplete: () => void;
  onSkip: () => void;
}

function AgentStep({ onComplete, onSkip }: AgentStepProps) {
  const [name, setName] = useState("");
  const [workspace, setWorkspace] = useState("");
  const [model, setModel] = useState("claude-opus-4-6");
  const [soul, setSoul] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const models = useModelStore((s) => s.models);
  const fetchAgents = useAgentStore((s) => s.fetchAgents);
  const addToast = useUIStore((s) => s.addToast);

  const validate = useCallback(() => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Name is required";
    if (!workspace.trim())
      errs.workspace = "Workspace path is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [name, workspace]);

  const handleCreate = useCallback(async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const addArgs = [
        "agents",
        "add",
        name.trim(),
        "--workspace",
        workspace.trim(),
        "--non-interactive",
      ];
      if (model) addArgs.push("--model", model);
      const addResult = await execCli(addArgs);
      if (addResult === null) {
        throw new Error("Not running inside Tauri");
      }
      if (addResult.exitCode !== 0) {
        throw new Error(
          addResult.stderr || "Failed to create agent",
        );
      }

      await fetchAgents();

      // Write SOUL.md if provided (best-effort)
      if (soul.trim()) {
        const freshList = useAgentStore.getState().agentList;
        const createdAgent = freshList.find(
          (a) => a.name === name.trim(),
        );
        if (createdAgent) {
          try {
            await writeWorkspaceFile(
              createdAgent.id,
              "SOUL.md",
              soul.trim(),
            );
          } catch (soulErr) {
            console.warn("Failed to write SOUL.md:", soulErr);
          }
        }
      }

      addToast({
        type: "success",
        message: `Agent "${name}" created`,
      });
      onComplete();
    } catch (err) {
      addToast({
        type: "error",
        message:
          err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmitting(false);
    }
  }, [
    validate,
    name,
    workspace,
    model,
    soul,
    fetchAgents,
    addToast,
    onComplete,
  ]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-secondary">
        Set up your first agent to start working with OpenClaw.
      </p>

      <Input
        id="onboarding-agent-name"
        label="Name *"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setWorkspace(defaultWorkspace(e.target.value));
        }}
        error={errors.name}
        placeholder="e.g., Brokkr"
        disabled={submitting}
      />

      <div className="flex flex-col gap-1">
        <label
          htmlFor="onboarding-agent-workspace"
          className="text-sm font-medium text-text-primary"
        >
          Workspace Path *
        </label>
        <div
          className={
            "flex h-8 items-center rounded-md border"
            + " border-[var(--input-border)]"
            + " bg-[var(--input-bg)] px-3 text-sm"
            + " text-text-secondary"
          }
        >
          {workspace || (
            <span className="text-text-tertiary">
              Auto-generated from name
            </span>
          )}
        </div>
        {errors.workspace && (
          <p className="text-xs text-status-error">
            {errors.workspace}
          </p>
        )}
      </div>

      <Select
        id="onboarding-agent-model"
        label="Default Model"
        value={model}
        onChange={(e) => setModel(e.target.value)}
        disabled={submitting}
      >
        {models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.id}
          </option>
        ))}
      </Select>

      <Textarea
        id="onboarding-agent-soul"
        label="Identity / SOUL (optional)"
        value={soul}
        onChange={(e) => setSoul(e.target.value)}
        placeholder="Describe this agent's persona..."
        rows={3}
        disabled={submitting}
      />

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          className={
            "text-sm text-text-tertiary underline"
            + " hover:text-text-secondary"
          }
          onClick={onSkip}
        >
          Skip Setup
        </button>
        <Button onClick={handleCreate} disabled={submitting}>
          {submitting ? "Creating..." : "Create Agent"}
        </Button>
      </div>
    </div>
  );
}
