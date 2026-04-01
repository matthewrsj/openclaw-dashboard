import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useUIStore } from "@/stores/ui";
import { useAgentStore } from "@/stores/agents";
import { execCli } from "@/services/tauri-commands";
import { useNavigate } from "@tanstack/react-router";

interface DeleteConfirmModalProps { open: boolean; onClose: () => void; agentId: string; agentName: string; }

export function DeleteConfirmModal({ open, onClose, agentId, agentName }: DeleteConfirmModalProps) {
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const addToast = useUIStore((s) => s.addToast);
  const fetchAgents = useAgentStore((s) => s.fetchAgents);
  const navigate = useNavigate();
  const isConfirmed = confirmation === agentName;

  const handleDelete = async () => {
    if (!isConfirmed) return;
    setDeleting(true);
    try {
      const result = await execCli(["agents", "delete", agentId, "--yes"]);
      if (result === null) throw new Error("Not running inside Tauri");
      if (result.exitCode !== 0) throw new Error(result.stderr || "Failed to delete agent");
      addToast({ type: "success", message: `Agent "${agentName}" deleted` });
      await fetchAgents();
      navigate({ to: "/" });
      onClose();
    } catch (err) {
      addToast({ type: "error", message: err instanceof Error ? err.message : String(err) });
    } finally { setDeleting(false); }
  };

  if (!open) return null;

  return (
    <Modal onClose={onClose} title="Delete Agent" preventClose={deleting}
      footer={<><Button variant="secondary" onClick={onClose} disabled={deleting}>Cancel</Button><Button variant="danger" onClick={handleDelete} disabled={!isConfirmed || deleting}>{deleting ? "Deleting…" : "Delete Agent"}</Button></>}>
      <div className="space-y-4">
        <p className="text-sm text-text-primary">⚠️ This action cannot be undone.</p>
        <p className="text-sm text-text-secondary">Deleting <strong>{agentName}</strong> will remove all agent configuration and terminate active sessions.</p>
        <Input id="delete-confirm" label={`Type "${agentName}" to confirm:`} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder={agentName} />
      </div>
    </Modal>
  );
}