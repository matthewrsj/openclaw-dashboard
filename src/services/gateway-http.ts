/**
 * HTTP client for the Gateway's OpenAI-compatible REST API.
 *
 * Handles chat completions (streaming) and model listing.
 */

import type {
  ChatCompletionChunk,
  ChatCompletionRequest,
  Model,
} from "../types/chat";

/** Convert a WebSocket URL to its HTTP equivalent. */
function wsToHttp(url: string): string {
  return url.replace(/^wss:\/\//, "https://").replace(/^ws:\/\//, "http://");
}

/** Gateway HTTP client for REST API calls. */
export class GatewayHttpClient {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = wsToHttp(baseUrl);
    this.token = token;
  }

  /** Update the base URL. */
  setBaseUrl(url: string): void {
    this.baseUrl = wsToHttp(url);
  }

  /** Update the auth token. */
  setToken(token: string): void {
    this.token = token;
  }

  /** Build authorization headers. */
  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
    };
  }

  /** List available models. */
  async listModels(): Promise<Model[]> {
    const res = await fetch(`${this.baseUrl}/v1/models`, {
      headers: this.headers(),
    });
    if (!res.ok) {
      throw new Error(`Model list failed: ${res.status} ${await res.text()}`);
    }
    const data = await res.json();
    return data.data as Model[];
  }

  /**
   * Stream a chat completion response.
   *
   * Yields individual chunks as they arrive from the SSE stream.
   * Supports cancellation via AbortSignal.
   */
  async *streamChatCompletion(
    request: ChatCompletionRequest,
    signal?: AbortSignal,
  ): AsyncGenerator<ChatCompletionChunk> {
    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ ...request, stream: true }),
      signal,
    });

    if (!res.ok) {
      throw new Error(
        `Chat API error: ${res.status} ${await res.text()}`,
      );
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop()!;

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") return;
          yield JSON.parse(data) as ChatCompletionChunk;
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

/** Singleton HTTP client instance. */
let httpClient: GatewayHttpClient | null = null;

/** Get or create the singleton HTTP client. */
export function getHttpClient(
  baseUrl?: string,
  token?: string,
): GatewayHttpClient {
  if (!httpClient && baseUrl) {
    // Initialize with whatever token we have (may be empty, updated later)
    httpClient = new GatewayHttpClient(baseUrl, token || "");
  }
  if (!httpClient) {
    throw new Error("HTTP client not initialized — provide baseUrl");
  }
  if (baseUrl) httpClient.setBaseUrl(baseUrl);
  if (token) httpClient.setToken(token);
  return httpClient;
}
