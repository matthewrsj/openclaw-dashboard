import { describe, it, expect, beforeEach } from "vitest";
import { useChatStore } from "@/stores/chat";
import { createMockChatMessage } from "../helpers/mock-data";

describe("ChatStore", () => {
  beforeEach(() => {
    useChatStore.setState({
      messages: new Map(),
      drafts: new Map(),
      scrollPositions: new Map(),
      streamingState: new Map(),
      activeAgentId: null,
    });
  });

  describe("addMessage", () => {
    it("adds a message to the specified session", () => {
      const msg = createMockChatMessage({ sessionKey: "session-1" });
      useChatStore.getState().addMessage("session-1", msg);
      expect(useChatStore.getState().getMessages("session-1")).toHaveLength(1);
    });

    it("appends messages in order", () => {
      const msg1 = createMockChatMessage({ id: "m1", content: "First" });
      const msg2 = createMockChatMessage({ id: "m2", content: "Second" });
      const store = useChatStore.getState();
      store.addMessage("session-1", msg1);
      store.addMessage("session-1", msg2);
      const messages = useChatStore.getState().getMessages("session-1");
      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe("First");
      expect(messages[1].content).toBe("Second");
    });

    it("creates separate lists for different sessions", () => {
      const msg1 = createMockChatMessage({ sessionKey: "session-1" });
      const msg2 = createMockChatMessage({ sessionKey: "session-2" });
      const store = useChatStore.getState();
      store.addMessage("session-1", msg1);
      store.addMessage("session-2", msg2);
      expect(useChatStore.getState().getMessages("session-1")).toHaveLength(1);
      expect(useChatStore.getState().getMessages("session-2")).toHaveLength(1);
    });
  });

  describe("updateMessage", () => {
    it("updates a message by ID", () => {
      const msg = createMockChatMessage({ id: "m1", status: "streaming", content: "" });
      useChatStore.getState().addMessage("session-1", msg);

      useChatStore.getState().updateMessage("session-1", "m1", {
        content: "Updated content",
        status: "sent",
      });

      const updated = useChatStore.getState().getMessages("session-1")[0];
      expect(updated.content).toBe("Updated content");
      expect(updated.status).toBe("sent");
    });

    it("does nothing for non-existent message", () => {
      const msg = createMockChatMessage({ id: "m1" });
      useChatStore.getState().addMessage("session-1", msg);
      useChatStore.getState().updateMessage("session-1", "nonexistent", { content: "X" });
      expect(useChatStore.getState().getMessages("session-1")[0].content).toBe(msg.content);
    });
  });

  describe("drafts", () => {
    it("sets and retrieves draft text", () => {
      useChatStore.getState().setDraft("brokkr", "Hello draft");
      expect(useChatStore.getState().getDraft("brokkr")).toBe("Hello draft");
    });

    it("returns empty string for missing draft", () => {
      expect(useChatStore.getState().getDraft("nonexistent")).toBe("");
    });

    it("overwrites existing draft", () => {
      useChatStore.getState().setDraft("brokkr", "Old");
      useChatStore.getState().setDraft("brokkr", "New");
      expect(useChatStore.getState().getDraft("brokkr")).toBe("New");
    });
  });

  describe("scrollPositions", () => {
    it("sets and retrieves scroll position", () => {
      useChatStore.getState().setScrollPosition("brokkr", 500);
      expect(useChatStore.getState().scrollPositions.get("brokkr")).toBe(500);
    });
  });

  describe("streamingState", () => {
    it("initializes streaming state", () => {
      useChatStore.getState().setStreamingState("session-1", {
        isStreaming: true,
      });
      expect(useChatStore.getState().isStreaming("session-1")).toBe(true);
    });

    it("stops streaming", () => {
      useChatStore.getState().setStreamingState("session-1", { isStreaming: true });
      useChatStore.getState().setStreamingState("session-1", { isStreaming: false });
      expect(useChatStore.getState().isStreaming("session-1")).toBe(false);
    });

    it("returns false for non-streaming session", () => {
      expect(useChatStore.getState().isStreaming("unknown")).toBe(false);
    });
  });

  describe("activeAgentId", () => {
    it("sets active agent", () => {
      useChatStore.getState().setActiveAgentId("brokkr");
      expect(useChatStore.getState().activeAgentId).toBe("brokkr");
    });

    it("clears active agent", () => {
      useChatStore.getState().setActiveAgentId("brokkr");
      useChatStore.getState().setActiveAgentId(null);
      expect(useChatStore.getState().activeAgentId).toBeNull();
    });
  });

  describe("clearMessages", () => {
    it("clears messages for a session", () => {
      const msg = createMockChatMessage();
      useChatStore.getState().addMessage("session-1", msg);
      useChatStore.getState().clearMessages("session-1");
      expect(useChatStore.getState().getMessages("session-1")).toHaveLength(0);
    });

    it("does not affect other sessions", () => {
      const msg1 = createMockChatMessage();
      const msg2 = createMockChatMessage();
      useChatStore.getState().addMessage("session-1", msg1);
      useChatStore.getState().addMessage("session-2", msg2);
      useChatStore.getState().clearMessages("session-1");
      expect(useChatStore.getState().getMessages("session-2")).toHaveLength(1);
    });
  });

  describe("getMessages", () => {
    it("returns empty array for unknown session", () => {
      expect(useChatStore.getState().getMessages("unknown")).toEqual([]);
    });
  });
});
