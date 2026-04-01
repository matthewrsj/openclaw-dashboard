import { useState } from "react";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settings";
import { useGatewayStore } from "@/stores/gateway";
import { useUIStore } from "@/stores/ui";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

const SECTIONS = [
  { id: "general", label: "General" },
  { id: "appearance", label: "Appearance" },
  { id: "connection", label: "Connection" },
  { id: "about", label: "About" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

/** Application settings page. */
export function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SectionId>("general");

  return (
    <div className="flex h-full">
      {/* Section nav */}
      <div className="w-48 border-r border-border-primary bg-bg-secondary p-2">
        {SECTIONS.map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={cn(
              "flex w-full rounded-md px-3 py-1.5 text-sm transition-colors",
              activeSection === section.id
                ? "bg-bg-active text-text-primary font-medium"
                : "text-text-secondary hover:bg-bg-hover",
            )}
          >
            {section.label}
          </button>
        ))}
      </div>

      {/* Section content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeSection === "general" && <GeneralSettings />}
        {activeSection === "appearance" && <AppearanceSettings />}
        {activeSection === "connection" && <ConnectionSettings />}
        {activeSection === "about" && <AboutSettings />}
      </div>
    </div>
  );
}

function GeneralSettings() {
  const enterToSend = useSettingsStore((s) => s.enterToSend);
  const setEnterToSend = useSettingsStore((s) => s.setEnterToSend);

  return (
    <div className="max-w-lg space-y-6">
      <h2 className="text-lg font-semibold text-text-primary">General</h2>
      <label className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-text-primary">Enter to send</p>
          <p className="text-xs text-text-secondary">
            Press Enter to send messages (Shift+Enter for new line)
          </p>
        </div>
        <button
          onClick={() => setEnterToSend(!enterToSend)}
          className={cn(
            "h-5 w-9 rounded-full transition-colors",
            enterToSend ? "bg-accent-primary" : "bg-border-primary",
          )}
        >
          <div
            className={cn(
              "h-4 w-4 rounded-full bg-white transition-transform",
              enterToSend ? "translate-x-4" : "translate-x-0.5",
            )}
          />
        </button>
      </label>
    </div>
  );
}

function AppearanceSettings() {
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);

  return (
    <div className="max-w-lg space-y-6">
      <h2 className="text-lg font-semibold text-text-primary">Appearance</h2>
      <div className="space-y-2">
        <p className="text-sm font-medium text-text-primary">Theme</p>
        <div className="flex gap-3">
          {(["system", "light", "dark"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={cn(
                "rounded-md border px-4 py-2 text-sm capitalize transition-colors",
                theme === t
                  ? "border-accent-primary bg-accent-primary/10 text-text-primary"
                  : "border-border-primary text-text-secondary hover:bg-bg-hover",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ConnectionSettings() {
  const gatewayUrl = useSettingsStore((s) => s.gatewayUrl);
  const setGatewayUrl = useSettingsStore((s) => s.setGatewayUrl);
  const connectionState = useGatewayStore((s) => s.connectionState);
  const openModal = useUIStore((s) => s.openModal);

  return (
    <div className="max-w-lg space-y-6">
      <h2 className="text-lg font-semibold text-text-primary">Connection</h2>
      <Input
        id="settings-gw-url"
        label="Gateway URL"
        value={gatewayUrl}
        onChange={(e) => setGatewayUrl(e.target.value)}
      />
      <div className="flex items-center gap-3">
        <span className="text-sm text-text-secondary">
          Status: {connectionState}
        </span>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => openModal({ type: "connection" })}
        >
          Reconnect
        </Button>
      </div>
    </div>
  );
}

function AboutSettings() {
  const version = useGatewayStore((s) => s.version);

  return (
    <div className="max-w-lg space-y-4">
      <h2 className="text-lg font-semibold text-text-primary">About</h2>
      <div className="space-y-2 text-sm text-text-secondary">
        <p>
          <strong className="text-text-primary">App Version:</strong> 0.1.0
        </p>
        <p>
          <strong className="text-text-primary">Gateway Version:</strong>{" "}
          {version || "Unknown"}
        </p>
        <p>
          <strong className="text-text-primary">Framework:</strong> Tauri v2 + React 19
        </p>
      </div>
    </div>
  );
}
