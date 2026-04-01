/**
 * Typed wrappers around Tauri `invoke()` calls.
 *
 * Each function corresponds to a `#[tauri::command]` in the Rust backend.
 * Using typed wrappers ensures consistent parameter naming and return types.
 *
 * All calls are guarded by `isTauriAvailable()` so the app can render its
 * shell even when loaded outside the Tauri webview (e.g. plain browser via
 * `npm run dev`).
 */

import { invoke } from "@tauri-apps/api/core";
import type { CliOutput, FileEntry } from "../types/ui";

// ---------------------------------------------------------------------------
// Tauri availability guard
// ---------------------------------------------------------------------------

/** Check if running inside a Tauri webview. */
export function isTauriAvailable(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Safe invoke that returns `null` when Tauri is not available. */
async function safeInvoke<T>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T | null> {
  if (!isTauriAvailable()) {
    console.warn(`Tauri not available, skipping invoke("${cmd}")`);
    return null;
  }
  return invoke<T>(cmd, args);
}

// === Auth Commands ===

/** Retrieve the bearer token from macOS Keychain. */
export async function getToken(): Promise<string | null> {
  return safeInvoke<string>("get_token");
}

/** Store a bearer token in macOS Keychain. */
export async function setToken(token: string): Promise<void> {
  await safeInvoke("set_token", { token });
}

/** Delete the bearer token from macOS Keychain. */
export async function deleteToken(): Promise<void> {
  await safeInvoke("delete_token");
}

// === Gateway Commands ===

/** Establish a WebSocket connection to the Gateway. */
export async function connectGateway(
  url: string,
  token: string,
): Promise<void> {
  await safeInvoke("connect_gateway", { url, token });
}

/** Disconnect from the Gateway WebSocket. */
export async function disconnectGateway(): Promise<void> {
  await safeInvoke("disconnect_gateway");
}

/** Send an RPC call to the Gateway over the WebSocket. */
export async function gatewayRpc<T>(
  method: string,
  params: Record<string, unknown> = {},
): Promise<T | null> {
  return safeInvoke<T>("gateway_rpc", { method, params });
}

/** Get the current connection state. */
export async function getConnectionState(): Promise<string | null> {
  return safeInvoke<string>("get_connection_state");
}

// === CLI Commands ===

/** Execute an `openclaw` CLI command. Returns `null` outside Tauri. */
export async function execCli(args: string[]): Promise<CliOutput | null> {
  return safeInvoke<CliOutput>("exec_cli", { args });
}

/** Execute an `openclaw` CLI command and parse JSON output. Returns `null` outside Tauri. */
export async function execCliJson<T>(args: string[]): Promise<T | null> {
  const result = await execCli([...args, "--json"]);
  if (result === null) return null;
  if (result.exitCode !== 0) {
    throw new Error(
      result.stderr || `CLI exited with code ${result.exitCode}`,
    );
  }
  return JSON.parse(result.stdout) as T;
}

// === File Commands ===

/** Get the workspace path for an agent. */
export async function getAgentWorkspacePath(
  agentId: string,
): Promise<string | null> {
  return safeInvoke<string>("get_agent_workspace_path", { agentId });
}

/** Read a file from an agent's workspace. */
export async function readWorkspaceFile(
  agentId: string,
  relativePath: string,
): Promise<string | null> {
  return safeInvoke<string | null>("read_workspace_file", {
    agentId,
    relativePath,
  });
}

/** List files in an agent's workspace directory. */
export async function listWorkspaceFiles(
  agentId: string,
  relativePath: string,
): Promise<FileEntry[] | null> {
  return safeInvoke<FileEntry[]>("list_workspace_files", {
    agentId,
    relativePath,
  });
}

// === Log Commands ===

/** Read the last N lines from an agent's log. */
export async function tailLog(
  agentId: string,
  lines: number,
): Promise<string[] | null> {
  return safeInvoke<string[]>("tail_log", { agentId, lines });
}

/** Start streaming new log lines via events. */
export async function startLogTail(agentId: string): Promise<void> {
  await safeInvoke("start_log_tail", { agentId });
}

/** Stop streaming log lines. */
export async function stopLogTail(agentId: string): Promise<void> {
  await safeInvoke("stop_log_tail", { agentId });
}
