/**
 * UI state store.
 *
 * Manages sidebar state, command palette, toasts, and modals.
 */

import { create } from "zustand";
import type { Toast, ModalState } from "../types/ui";

interface UIStore {
  /** Whether the sidebar is expanded. */
  sidebarExpanded: boolean;
  /** Whether the command palette is open. */
  commandPaletteOpen: boolean;
  /** Active toast notifications. */
  toasts: Toast[];
  /** Currently active modal. */
  activeModal: ModalState | null;

  // Actions
  toggleSidebar: () => void;
  setSidebarExpanded: (expanded: boolean) => void;
  toggleCommandPalette: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  addToast: (toast: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
  openModal: (modal: ModalState) => void;
  closeModal: () => void;
}

let toastCounter = 0;

export const useUIStore = create<UIStore>((set, get) => ({
  sidebarExpanded: true,
  commandPaletteOpen: false,
  toasts: [],
  activeModal: null,

  toggleSidebar: () =>
    set({ sidebarExpanded: !get().sidebarExpanded }),

  setSidebarExpanded: (expanded: boolean) =>
    set({ sidebarExpanded: expanded }),

  toggleCommandPalette: () =>
    set({ commandPaletteOpen: !get().commandPaletteOpen }),

  setCommandPaletteOpen: (open: boolean) =>
    set({ commandPaletteOpen: open }),

  addToast: (toast: Omit<Toast, "id">) => {
    const id = `toast-${++toastCounter}`;
    const newToast: Toast = { ...toast, id };
    set({ toasts: [...get().toasts, newToast] });

    // Auto-dismiss after duration (default 5s)
    const duration = toast.duration === null ? null : (toast.duration ?? 5000);
    if (duration !== null) {
      setTimeout(() => {
        get().dismissToast(id);
      }, duration);
    }
  },

  dismissToast: (id: string) =>
    set({ toasts: get().toasts.filter((t) => t.id !== id) }),

  openModal: (modal: ModalState) => set({ activeModal: modal }),

  closeModal: () => set({ activeModal: null }),
}));
