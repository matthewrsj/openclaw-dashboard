import { describe, it, expect } from "vitest";
import { render, screen } from "../../helpers/render";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { createMockChatMessage } from "../../helpers/mock-data";

describe("ChatMessage", () => {
  it("renders user message content", () => {
    const msg = createMockChatMessage({ role: "user", content: "Hello!" });
    render(<ChatMessage message={msg} />);
    expect(screen.getByText("Hello!")).toBeInTheDocument();
  });

  it("renders assistant message content", () => {
    const msg = createMockChatMessage({ role: "assistant", content: "Hi there!" });
    render(<ChatMessage message={msg} />);
    expect(screen.getByText("Hi there!")).toBeInTheDocument();
  });

  it("shows user avatar for user messages", () => {
    const msg = createMockChatMessage({ role: "user" });
    render(<ChatMessage message={msg} />);
    expect(screen.getByText("👤")).toBeInTheDocument();
  });

  it("shows agent emoji for assistant messages", () => {
    const msg = createMockChatMessage({ role: "assistant" });
    render(<ChatMessage message={msg} agentEmoji="⚒️" />);
    expect(screen.getByText("⚒️")).toBeInTheDocument();
  });

  it("shows default robot emoji when no agent emoji provided", () => {
    const msg = createMockChatMessage({ role: "assistant" });
    render(<ChatMessage message={msg} />);
    expect(screen.getByText("🤖")).toBeInTheDocument();
  });

  it("renders markdown content (bold)", () => {
    const msg = createMockChatMessage({
      role: "assistant",
      content: "This is **bold** text",
    });
    render(<ChatMessage message={msg} />);
    expect(screen.getByText("bold")).toBeInTheDocument();
    const strong = document.querySelector("strong");
    expect(strong).toBeInTheDocument();
  });

  it("renders markdown content (code block)", () => {
    const msg = createMockChatMessage({
      role: "assistant",
      content: "```javascript\nconsole.log('hello');\n```",
    });
    render(<ChatMessage message={msg} />);
    expect(screen.getByText(/console/)).toBeInTheDocument();
  });

  it("renders markdown content (links)", () => {
    const msg = createMockChatMessage({
      role: "assistant",
      content: "Check [this link](https://example.com)",
    });
    render(<ChatMessage message={msg} />);
    const link = screen.getByRole("link", { name: "this link" });
    expect(link).toHaveAttribute("href", "https://example.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("shows streaming indicator when message is streaming with no content", () => {
    const msg = createMockChatMessage({ status: "streaming", content: "" });
    render(<ChatMessage message={msg} />);
    expect(screen.getByText("…")).toBeInTheDocument();
  });

  it("shows cursor animation when streaming with content", () => {
    const msg = createMockChatMessage({ status: "streaming", content: "Partial response" });
    const { container } = render(<ChatMessage message={msg} />);
    expect(screen.getByText("Partial response")).toBeInTheDocument();
    // Should show blinking cursor
    const cursor = container.querySelector(".animate-pulse");
    expect(cursor).toBeInTheDocument();
  });

  it("shows error message when status is error", () => {
    const msg = createMockChatMessage({
      status: "error",
      error: "Connection failed",
    });
    render(<ChatMessage message={msg} />);
    expect(screen.getByText("Connection failed")).toBeInTheDocument();
  });

  it("has article role for accessibility", () => {
    const msg = createMockChatMessage();
    render(<ChatMessage message={msg} />);
    expect(screen.getByRole("article")).toBeInTheDocument();
  });

  it("applies error border when message has error status", () => {
    const msg = createMockChatMessage({ status: "error" });
    const { container } = render(<ChatMessage message={msg} />);
    const content = container.querySelector(".border-status-error\\/30");
    expect(content).toBeInTheDocument();
  });
});
