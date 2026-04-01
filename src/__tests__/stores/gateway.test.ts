import { describe, it, expect, vi, beforeEach } from "vitest";
import { useGatewayStore } from "@/stores/gateway";

// Mock tauri-commands
vi.mock("@/services/tauri-commands", () => ({
  connectGateway: vi.fn(),
  disconnectGateway: vi.fn(),
  getToken: vi.fn(),
}));

describe("GatewayStore", () => {
  beforeEach(() => {
    useGatewayStore.setState({
      connectionState: "disconnected",
      url: "ws://localhost:18789",
      version: null,
      uptime: null,
      reconnectAttempt: 0,
      lastError: null,
    });
    vi.clearAllMocks();
  });

  describe("initial state", () => {
    it("starts disconnected", () => {
      const state = useGatewayStore.getState();
      expect(state.connectionState).toBe("disconnected");
      expect(state.url).toBe("ws://localhost:18789");
      expect(state.version).toBeNull();
      expect(state.uptime).toBeNull();
      expect(state.reconnectAttempt).toBe(0);
      expect(state.lastError).toBeNull();
    });
  });

  describe("connect", () => {
    it("transitions to connecting state", async () => {
      const { connectGateway } = await import("@/services/tauri-commands");
      (connectGateway as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise(() => {}), // never resolves
      );

      useGatewayStore.getState().connect("ws://localhost:18789", "test-token");
      expect(useGatewayStore.getState().connectionState).toBe("connecting");
      expect(useGatewayStore.getState().url).toBe("ws://localhost:18789");
    });

    it("sets error on connection failure", async () => {
      const { connectGateway } = await import("@/services/tauri-commands");
      (connectGateway as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Connection refused"),
      );

      await useGatewayStore.getState().connect("ws://localhost:18789", "token");
      const state = useGatewayStore.getState();
      expect(state.connectionState).toBe("disconnected");
      expect(state.lastError).toBe("Connection refused");
    });
  });

  describe("disconnect", () => {
    it("transitions to disconnected state", async () => {
      const { disconnectGateway } = await import("@/services/tauri-commands");
      (disconnectGateway as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      useGatewayStore.setState({ connectionState: "connected" });
      await useGatewayStore.getState().disconnect();
      expect(useGatewayStore.getState().connectionState).toBe("disconnected");
      expect(useGatewayStore.getState().reconnectAttempt).toBe(0);
    });

    it("handles disconnect error gracefully", async () => {
      const { disconnectGateway } = await import("@/services/tauri-commands");
      (disconnectGateway as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Already disconnected"),
      );

      useGatewayStore.setState({ connectionState: "connected" });
      await useGatewayStore.getState().disconnect();
      // Should still transition to disconnected
      expect(useGatewayStore.getState().connectionState).toBe("disconnected");
    });
  });

  describe("autoConnect", () => {
    it("auto-connects with stored token", async () => {
      const { getToken, connectGateway } = await import("@/services/tauri-commands");
      (getToken as ReturnType<typeof vi.fn>).mockResolvedValue("stored-token");
      (connectGateway as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      await useGatewayStore.getState().autoConnect();
      expect(connectGateway).toHaveBeenCalledWith("ws://localhost:18789", "stored-token");
    });

    it("does not connect when no token is stored", async () => {
      const { getToken, connectGateway } = await import("@/services/tauri-commands");
      (getToken as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await useGatewayStore.getState().autoConnect();
      expect(connectGateway).not.toHaveBeenCalled();
    });

    it("uses custom URL when provided", async () => {
      const { getToken, connectGateway } = await import("@/services/tauri-commands");
      (getToken as ReturnType<typeof vi.fn>).mockResolvedValue("token");
      (connectGateway as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      await useGatewayStore.getState().autoConnect("ws://custom:9999");
      expect(connectGateway).toHaveBeenCalledWith("ws://custom:9999", "token");
    });
  });

  describe("state setters", () => {
    it("setConnectionState updates state", () => {
      useGatewayStore.getState().setConnectionState("connected");
      expect(useGatewayStore.getState().connectionState).toBe("connected");
    });

    it("setReconnectAttempt updates attempt number", () => {
      useGatewayStore.getState().setReconnectAttempt(3);
      expect(useGatewayStore.getState().reconnectAttempt).toBe(3);
    });

    it("setLastError updates error", () => {
      useGatewayStore.getState().setLastError("Network error");
      expect(useGatewayStore.getState().lastError).toBe("Network error");
    });

    it("setLastError clears error with null", () => {
      useGatewayStore.setState({ lastError: "old error" });
      useGatewayStore.getState().setLastError(null);
      expect(useGatewayStore.getState().lastError).toBeNull();
    });

    it("setGatewayInfo updates version and uptime", () => {
      useGatewayStore.getState().setGatewayInfo("2026.3.24", 86400);
      const state = useGatewayStore.getState();
      expect(state.version).toBe("2026.3.24");
      expect(state.uptime).toBe(86400);
    });
  });

  describe("connection state transitions", () => {
    it("follows disconnected → connecting → connected flow", async () => {
      const { connectGateway } = await import("@/services/tauri-commands");
      (connectGateway as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      expect(useGatewayStore.getState().connectionState).toBe("disconnected");

      const connectPromise = useGatewayStore.getState().connect("ws://localhost:18789", "token");
      expect(useGatewayStore.getState().connectionState).toBe("connecting");

      await connectPromise;
      // Note: The store doesn't set "connected" on success — that comes from the
      // Rust backend via events. But lastError should be null.
      expect(useGatewayStore.getState().lastError).toBeNull();
    });

    it("supports reconnecting state", () => {
      useGatewayStore.getState().setConnectionState("reconnecting");
      useGatewayStore.getState().setReconnectAttempt(2);
      const state = useGatewayStore.getState();
      expect(state.connectionState).toBe("reconnecting");
      expect(state.reconnectAttempt).toBe(2);
    });
  });
});
