/** An in-app toast notification. */
export interface Toast {
  id: string;
  type: "success" | "error" | "warning" | "info";
  message: string;
  description?: string;
  /** Duration in ms before auto-dismiss. Null = persistent. */
  duration?: number | null;
  action?: { label: string; onClick: () => void };
}

/** A workspace file entry. */
export interface FileEntry {
  name: string;
  kind: "file" | "directory" | "missing";
  size: number;
}

/** CLI command output. */
export interface CliOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/** Modal state. */
export interface ModalState {
  type: string;
  props?: Record<string, unknown>;
}

/** Notification preferences. */
export interface NotificationPreferences {
  sessionComplete: boolean;
  execApproval: boolean;
  agentError: boolean;
  cronFailure: boolean;
}
