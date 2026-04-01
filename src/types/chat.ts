/** A chat message in a session. */
export interface ChatMessage {
  /** Unique message ID. */
  id: string;
  /** Session this message belongs to. */
  sessionKey: string;
  /** Message role. */
  role: "user" | "assistant" | "system";
  /** Markdown content. */
  content: string;
  /** Timestamp (Unix ms). */
  timestamp: number;
  /** Delivery status. */
  status: "sent" | "streaming" | "error";
  /** Token usage for this message. */
  tokens?: { input: number; output: number };
  /** Error message if status is "error". */
  error?: string;
}

/** State of a streaming response. */
export interface StreamingState {
  isStreaming: boolean;
  abortController: AbortController | null;
  partialContent: string;
}

/** Request body for the chat completions API. */
export interface ChatCompletionRequest {
  model: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  agent_id?: string;
  session_key?: string;
}

/** A single chunk from a streaming chat completion response. */
export interface ChatCompletionChunk {
  id: string;
  object: "chat.completion.chunk";
  choices: Array<{
    delta: { content?: string; role?: string };
    index: number;
    finish_reason: string | null;
  }>;
}

/** Model info from the /v1/models endpoint. */
export interface Model {
  id: string;
  object: "model";
  created: number;
  owned_by: string;
}
