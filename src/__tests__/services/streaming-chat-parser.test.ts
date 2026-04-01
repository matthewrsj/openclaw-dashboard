import { describe, it, expect } from "vitest";
import { parseSSEStream } from "@/services/streaming-chat-parser";
import { createMockSSEStream } from "../helpers/mock-data";

describe("parseSSEStream", () => {
  function createMockResponse(body: ReadableStream): Response {
    return {
      body,
      ok: true,
      status: 200,
    } as unknown as Response;
  }

  it("yields content from SSE chunks", async () => {
    const stream = createMockSSEStream(["Hello", " ", "world"]);
    const response = createMockResponse(stream);

    const chunks: string[] = [];
    for await (const content of parseSSEStream(response)) {
      chunks.push(content);
    }

    expect(chunks).toEqual(["Hello", " ", "world"]);
  });

  it("handles single chunk", async () => {
    const stream = createMockSSEStream(["Hello"]);
    const response = createMockResponse(stream);

    const chunks: string[] = [];
    for await (const content of parseSSEStream(response)) {
      chunks.push(content);
    }

    expect(chunks).toEqual(["Hello"]);
  });

  it("handles empty response (no chunks)", async () => {
    const stream = createMockSSEStream([]);
    const response = createMockResponse(stream);

    const chunks: string[] = [];
    for await (const content of parseSSEStream(response)) {
      chunks.push(content);
    }

    expect(chunks).toEqual([]);
  });

  it("stops on [DONE] sentinel", async () => {
    // Manually build a stream that ends with [DONE]
    const encoder = new TextEncoder();
    let index = 0;
    const lines = [
      'data: {"id":"c1","object":"chat.completion.chunk","choices":[{"delta":{"content":"Hi"},"index":0,"finish_reason":null}]}\n\n',
      "data: [DONE]\n\n",
      // This should never be reached
      'data: {"id":"c2","object":"chat.completion.chunk","choices":[{"delta":{"content":"NOPE"},"index":0,"finish_reason":null}]}\n\n',
    ];
    const stream = new ReadableStream({
      pull(controller) {
        if (index < lines.length) {
          controller.enqueue(encoder.encode(lines[index]));
          index++;
        } else {
          controller.close();
        }
      },
    });

    const response = createMockResponse(stream);
    const chunks: string[] = [];
    for await (const content of parseSSEStream(response)) {
      chunks.push(content);
    }

    expect(chunks).toEqual(["Hi"]);
  });

  it("throws when response has no body", async () => {
    const response = { body: null } as unknown as Response;
    await expect(async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of parseSSEStream(response)) {
        // noop
      }
    }).rejects.toThrow("Response has no body");
  });

  it("respects abort signal", async () => {
    const controller = new AbortController();
    // Create a stream that yields one chunk then aborts
    const encoder = new TextEncoder();
    let callCount = 0;
    const stream = new ReadableStream({
      pull(ctrl) {
        callCount++;
        if (callCount === 1) {
          ctrl.enqueue(
            encoder.encode(
              'data: {"id":"c1","object":"chat.completion.chunk","choices":[{"delta":{"content":"First"},"index":0,"finish_reason":null}]}\n\n',
            ),
          );
          // Abort after first chunk
          controller.abort();
        } else {
          ctrl.enqueue(
            encoder.encode(
              'data: {"id":"c2","object":"chat.completion.chunk","choices":[{"delta":{"content":"Second"},"index":0,"finish_reason":null}]}\n\n',
            ),
          );
        }
      },
    });

    const response = createMockResponse(stream);
    const chunks: string[] = [];
    for await (const content of parseSSEStream(response, controller.signal)) {
      chunks.push(content);
    }

    expect(chunks).toEqual(["First"]);
  });

  it("handles malformed JSON gracefully (warns, continues)", async () => {
    const encoder = new TextEncoder();
    let index = 0;
    const lines = [
      "data: {bad json}\n\n",
      'data: {"id":"c1","object":"chat.completion.chunk","choices":[{"delta":{"content":"Good"},"index":0,"finish_reason":null}]}\n\n',
      "data: [DONE]\n\n",
    ];
    const stream = new ReadableStream({
      pull(controller) {
        if (index < lines.length) {
          controller.enqueue(encoder.encode(lines[index]));
          index++;
        } else {
          controller.close();
        }
      },
    });

    const response = createMockResponse(stream);
    const chunks: string[] = [];
    for await (const content of parseSSEStream(response)) {
      chunks.push(content);
    }

    // Should skip the bad chunk and yield the good one
    expect(chunks).toEqual(["Good"]);
  });

  it("handles chunks split across read boundaries", async () => {
    const encoder = new TextEncoder();
    // Split a single SSE message across two reads
    const part1 = 'data: {"id":"c1","object":"chat.completion.';
    const part2 = 'chunk","choices":[{"delta":{"content":"Split"},"index":0,"finish_reason":null}]}\n\ndata: [DONE]\n\n';

    let index = 0;
    const parts = [part1, part2];
    const stream = new ReadableStream({
      pull(controller) {
        if (index < parts.length) {
          controller.enqueue(encoder.encode(parts[index]));
          index++;
        } else {
          controller.close();
        }
      },
    });

    const response = createMockResponse(stream);
    const chunks: string[] = [];
    for await (const content of parseSSEStream(response)) {
      chunks.push(content);
    }

    expect(chunks).toEqual(["Split"]);
  });
});
