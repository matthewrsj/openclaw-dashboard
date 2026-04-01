/**
 * SSE stream parser for OpenAI-compatible chat completions.
 *
 * Handles the `text/event-stream` response format, yielding
 * content deltas as they arrive.
 */

import type { ChatCompletionChunk } from "../types/chat";

/**
 * Parse an SSE stream and yield content strings.
 *
 * @param response - The fetch Response with a readable body stream.
 * @param signal - Optional AbortSignal for cancellation.
 * @yields Content strings from each chunk's delta.
 */
export async function* parseSSEStream(
  response: Response,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  if (!response.body) {
    throw new Error("Response has no body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      if (signal?.aborted) {
        reader.cancel();
        return;
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop()!;

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") return;

        try {
          const chunk = JSON.parse(data) as ChatCompletionChunk;
          const content = chunk.choices?.[0]?.delta?.content;
          if (content) yield content;
        } catch {
          console.warn("Failed to parse SSE chunk:", data);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
