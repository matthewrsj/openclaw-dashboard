import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useGatewayStore } from "@/stores/gateway";
import { useSettingsStore } from "@/stores/settings";
import { useUIStore } from "@/stores/ui";
import { setToken } from "@/services/tauri-commands";

interface ConnectionModalProps { open: boolean; onClose: () => void; }

export function ConnectionModal({ open, onClose }: ConnectionModalProps) {
  const gatewayUrl = useSettingsStore((s) => s.gatewayUrl);
  const setGatewayUrl = useSettingsStore((s) => s.setGatewayUrl);
  const connect = useGatewayStore((s) => s.connect);
  const lastError = useGatewayStore((s) => s.lastError);
  const addToast = useUIStore((s) => s.addToast);
  const [url, setUrl] = useState(gatewayUrl);
  const [token, setTokenValue] = useState("");
  const [testing, setTesting] = useState(false);

  const handleConnect = async () => {
    if (!url.trim() || !token.trim()) return;
    setTesting(true);
    try {
      await setToken(token.trim());
      setGatewayUrl(url.trim());
      await connect(url.trim(), token.trim());
      addToast({ type: "success", message: "Connected to Gateway" });
      onClose();
    } catch (err) {
      addToast({ type: "error", message: `Connection failed: ${err instanceof Error ? err.message : String(err)}` });
    } finally { setTesting(false); }
  };

  if (!open) return null;

  return (
    <Modal onClose={onClose} title="Gateway Connection"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={handleConnect} disabled={!url.trim() || !token.trim() || testing}>{testing ? "Connecting…" : "Connect"}</Button></>}>
      <div className="space-y-4">
        <Input id="gw-url" label="Gateway URL" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="ws://localhost:18789" />
        <Input id="gw-token" label="Bearer Token" type="password" value={token} onChange={(e) => setTokenValue(e.target.value)} placeholder="Paste your gateway token" />
        {lastError && <p className="text-xs text-status-error">{lastError}</p>}
        <p className="text-xs text-text-tertiary">The token will be stored securely in your macOS Keychain.</p>
      </div>
    </Modal>
  );
}