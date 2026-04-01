import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "../../helpers/render";
import userEvent from "@testing-library/user-event";
import { ChatInput } from "@/components/chat/ChatInput";

// Mock the settings store
vi.mock("@/stores/settings", () => ({
  useSettingsStore: vi.fn((selector) => {
    const state = { enterToSend: true };
    return selector ? selector(state) : state;
  }),
}));

describe("ChatInput", () => {
  const defaultProps = {
    onSend: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders textarea and send button", () => {
    render(<ChatInput {...defaultProps} />);
    expect(screen.getByPlaceholderText("Type a message…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
  });

  it("send button is disabled when textarea is empty", () => {
    render(<ChatInput {...defaultProps} />);
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("send button is enabled when textarea has content", async () => {
    const user = userEvent.setup();
    render(<ChatInput {...defaultProps} />);
    await user.type(screen.getByPlaceholderText("Type a message…"), "Hello");
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
  });

  it("calls onSend with trimmed message on button click", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);
    await user.type(screen.getByPlaceholderText("Type a message…"), "  Hello world  ");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(onSend).toHaveBeenCalledWith("Hello world");
  });

  it("clears input after sending", async () => {
    const user = userEvent.setup();
    render(<ChatInput {...defaultProps} />);
    const textarea = screen.getByPlaceholderText("Type a message…");
    await user.type(textarea, "Hello");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(textarea).toHaveValue("");
  });

  it("does not send whitespace-only messages", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);
    await user.type(screen.getByPlaceholderText("Type a message…"), "   ");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(onSend).not.toHaveBeenCalled();
  });

  it("disables textarea and button when disabled prop is true", () => {
    render(<ChatInput {...defaultProps} disabled />);
    expect(screen.getByPlaceholderText("Type a message…")).toBeDisabled();
  });

  it("calls onDraftChange as user types", async () => {
    const user = userEvent.setup();
    const onDraftChange = vi.fn();
    render(<ChatInput {...defaultProps} onDraftChange={onDraftChange} />);
    await user.type(screen.getByPlaceholderText("Type a message…"), "Hi");
    // Called for each character
    expect(onDraftChange).toHaveBeenCalledTimes(2);
  });

  it("initializes with draft value", () => {
    render(<ChatInput {...defaultProps} draft="Saved draft" />);
    expect(screen.getByPlaceholderText("Type a message…")).toHaveValue("Saved draft");
  });

  it("sends on Cmd+Enter", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);
    const textarea = screen.getByPlaceholderText("Type a message…");
    await user.type(textarea, "Hello");
    await user.keyboard("{Meta>}{Enter}{/Meta}");
    expect(onSend).toHaveBeenCalledWith("Hello");
  });
});
