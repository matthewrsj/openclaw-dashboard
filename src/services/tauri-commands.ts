/**
 * Typed wrappers around Tauri `invoke()` calls.
 *
 * Each function corresponds to a `#[tauri::command]` in the Rust backend.
 * Using typed wrappers ensures consistent parameter naming and return types.
 */

import { invoke } from "@tauri-apps/api/core";
import type { CliOutput, FileEntry } from "../types/ui";

// === Auth Commands ===

/** Retrieve the bearer token from macOS Keychain. */
export async function getToken(): Promise<string | null> {
  return invoke<string | null>("get_token");
}

/** Store a bearer token in macOS Keychain. */
export async function setToken(token: string): Promise<void> {
  return invoke("set_token", { token });
}

/** Delete the bearer token from macOS Keychain. */
export async function deleteToken(): Promise<void> {
  return invoke("delete_token");
}

// === Gateway Commands ===

/** Establish a WebSocket connection to the Gateway. */
export async function connectGateway(
  url: string,
  token: string,
): Promise<void> {
  return invoke("connect_gateway", { url, token });
}

/** Disconnect from the Gateway WebSocket. */
export async function disconnectGateway(): Promise<void> {
  return invoke("disconnect_gateway");
}

/** Send an RPC call to the Gateway over the WebSocket. */
export async function gatewayRpc<T>(
  method: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  return invoke<T>("gateway_rpc", { method, params });
}

/** Get the current connection state. */
export async function getConnectionState(): Promise<string> {
  return invoke<string>("get_connection_state");
}

// === CLI Commands ===

/** Execute an `openclaw` CLI command. */
export async function execCli(args: string[]): Promise<CliOutput> {
  return invoke<CliOutput>("exec_cli", { args });
}

/** Execute an `openclaw` CLI command and parse JSON output. */
export async function execCliJson<T>(args: string[]): Promise<T> {
  const result = await execCli([...args, "--json"]);
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
): Promise<string> {
  return invoke<string>("get_agent_workspace_path", { agentId });
}

/** Read a file from an agent's workspace. */
export async function readWorkspaceFile(
  agentId: string,
  relativePath: string,
): Promise<string | null> {
  return invoke<string | null>("read_workspace_file", {
    agentId,
    relativePath,
  });
}

/** List files in an agent's workspace directory. */
export async function listWorkspaceFiles(
  agentId: string,
  relativePath: string,
): Promise<FileEntry[]> {
  return invoke<FileEntry[]>("list_workspace_files", {
    agentId,
    relativePath,
  });
}

// === Log Commands ===

/** Read the last N lines from an agent's log. */
export async function tailLog(
  agentId: string,
  lines: number,
): Promise<string[]> {
  return invoke<string[]>("tail_log", { agentId, lines });
}

/** Start streaming new log lines via events. */
export async function startLogTail(agentId: string): Promise<void> {
  return invoke("start_log_tail", { agentId });
}

/** Stop streaming log lines. */
export async function stopLogTail(agentId: string): Promise<void> {
  return invoke("stop_log_tail", { agentId });
}
