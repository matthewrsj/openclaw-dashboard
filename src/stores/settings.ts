/**
 * Settings store.
 *
 * Persisted user preferences via tauri-plugin-store.
 */

import { create } from "zustand";
import type { NotificationPreferences } from "../types/ui";

interface SettingsStore {
  /** Theme preference. */
  theme: "system" | "light" | "dark";
  /** Whether Enter sends a message (vs Shift+Enter). */
  enterToSend: boolean;
  /** Default view on launch. */
  defaultView: "fleet" | "chat";
  /** Default sidebar state. */
  sidebarDefault: "expanded" | "collapsed";
  /** Notification preferences. */
  notifications: NotificationPreferences;
  /** Gateway URL. */
  gatewayUrl: string;

  // Actions
  setTheme: (theme: "system" | "light" | "dark") => void;
  setEnterToSend: (value: boolean) => void;
  setGatewayUrl: (url: string) => void;
  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  theme: "system",
  enterToSend: true,
  defaultView: "fleet",
  sidebarDefault: "expanded",
  notifications: {
    sessionComplete: true,
    execApproval: true,
    agentError: true,
    cronFailure: true,
  },
  gatewayUrl: "ws://localhost:18789",

  setTheme: (theme) => {
    set({ theme });
    applyTheme(theme);
    get().saveSettings();
  },

  setEnterToSend: (value) => {
    set({ enterToSend: value });
    get().saveSettings();
  },

  setGatewayUrl: (url) => {
    set({ gatewayUrl: url });
    get().saveSettings();
  },

  loadSettings: async () => {
    try {
      const { load } = await import("@tauri-apps/plugin-store");
      const store = await load("settings.json", { autoSave: true, defaults: {} });
      const theme = await store.get<string>("theme");
      const enterToSend = await store.get<boolean>("enterToSend");
      const gatewayUrl = await store.get<string>("gatewayUrl");

      set({
        theme: (theme as "system" | "light" | "dark") || "system",
        enterToSend: enterToSend ?? true,
        gatewayUrl: gatewayUrl || "ws://localhost:18789",
      });

      applyTheme(get().theme);
    } catch (err) {
      console.warn("Failed to load settings:", err);
    }
  },

  saveSettings: async () => {
    try {
      const { load } = await import("@tauri-apps/plugin-store");
      const store = await load("settings.json", { autoSave: true, defaults: {} });
      const state = get();
      await store.set("theme", state.theme);
      await store.set("enterToSend", state.enterToSend);
      await store.set("gatewayUrl", state.gatewayUrl);
      await store.save();
    } catch (err) {
      console.warn("Failed to save settings:", err);
    }
  },
}));

/** Apply the theme to the document element. */
function applyTheme(theme: "system" | "light" | "dark"): void {
  if (theme === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", theme);
  }
}
