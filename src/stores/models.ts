/**
 * Model store.
 *
 * Fetches available models from the Gateway's /v1/models endpoint,
 * falling back to a hardcoded default list when the gateway is
 * unreachable or the HTTP client is not yet initialized.
 */

import { create } from "zustand";
import type { Model } from "../types/chat";

const DEFAULT_MODELS: Model[] = [
  { id: "claude-opus-4-6", object: "model", created: 0, owned_by: "anthropic" },
  {
    id: "claude-sonnet-4-20250514",
    object: "model",
    created: 0,
    owned_by: "anthropic",
  },
  { id: "gpt-4o", object: "model", created: 0, owned_by: "openai" },
];

interface ModelStore {
  /** Available models. */
  models: Model[];
  /** Whether a fetch is in progress. */
  loading: boolean;

  // Actions
  fetchModels: () => Promise<void>;
}

export const useModelStore = create<ModelStore>((set) => ({
  models: DEFAULT_MODELS,
  loading: false,

  fetchModels: async () => {
    set({ loading: true });
    try {
      const { getHttpClient } = await import(
        "../services/gateway-http"
      );
      const client = getHttpClient();
      const models = await client.listModels();
      set({ models, loading: false });
    } catch {
      // Gateway unreachable or client not initialized -- keep defaults
      set((state) => ({
        loading: false,
        models: state.models.length > 0 ? state.models : DEFAULT_MODELS,
      }));
    }
  },
}));
