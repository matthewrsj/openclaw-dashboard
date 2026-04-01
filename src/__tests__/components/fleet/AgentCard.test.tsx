import { describe, it, expect, vi } from "vitest";
import { render, screen } from "../../helpers/render";
import { AgentCard } from "@/components/fleet/AgentCard";
import { createMockAgent } from "../../helpers/mock-data";

// Mock TanStack Router's Link component
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string; [key: string]: unknown }) => (
    <a href={to} {...props}>{children}</a>
  ),
}));

describe("AgentCard", () => {
  it("renders agent name and emoji", () => {
    const agent = createMockAgent({ name: "Brokkr", emoji: "⚒️" });
    render(<AgentCard agent={agent} />);
    expect(screen.getByText("Brokkr")).toBeInTheDocument();
    expect(screen.getByText("⚒️")).toBeInTheDocument();
  });

  it("renders agent model", () => {
    const agent = createMockAgent({ model: "claude-opus-4-6" });
    render(<AgentCard agent={agent} />);
    expect(screen.getByText("claude-opus-4-6")).toBeInTheDocument();
  });

  it("renders active status badge", () => {
    const agent = createMockAgent({ status: "active" });
    render(<AgentCard agent={agent} />);
    expect(screen.getByText("active")).toBeInTheDocument();
  });

  it("renders inactive status badge", () => {
    const agent = createMockAgent({ status: "inactive" });
    render(<AgentCard agent={agent} />);
    expect(screen.getByText("inactive")).toBeInTheDocument();
  });

  it("renders error status badge", () => {
    const agent = createMockAgent({ status: "error" });
    render(<AgentCard agent={agent} />);
    expect(screen.getByText("error")).toBeInTheDocument();
  });

  it("displays activity text when agent is working", () => {
    const agent = createMockAgent({ activity: "Working on TASK-002" });
    render(<AgentCard agent={agent} />);
    expect(screen.getByText("Working on TASK-002")).toBeInTheDocument();
  });

  it("does not display activity text when null", () => {
    const agent = createMockAgent({ activity: null });
    render(<AgentCard agent={agent} />);
    expect(screen.queryByText("Working on")).not.toBeInTheDocument();
  });

  it("displays token and cost information", () => {
    const agent = createMockAgent({
      tokensToday: { input: 50000, output: 30000 },
      costToday: 2.4,
    });
    render(<AgentCard agent={agent} />);
    expect(screen.getByText("80.0K")).toBeInTheDocument(); // 50K + 30K
    expect(screen.getByText("$2.40")).toBeInTheDocument();
  });

  it("displays subagent count when subagents exist", () => {
    const agent = createMockAgent({
      subagents: [
        {
          key: "sub-1",
          label: "QA",
          status: "running",
          model: "claude-opus-4-6",
          startedAt: Date.now(),
          endedAt: null,
          durationMs: 0,
          tokens: null,
          error: null,
        },
        {
          key: "sub-2",
          label: "Impl",
          status: "completed",
          model: "claude-opus-4-6",
          startedAt: Date.now() - 60000,
          endedAt: Date.now(),
          durationMs: 60000,
          tokens: null,
          error: null,
        },
      ],
    });
    render(<AgentCard agent={agent} />);
    expect(screen.getByText("2 active subagents")).toBeInTheDocument();
  });

  it("shows singular 'subagent' for 1 subagent", () => {
    const agent = createMockAgent({
      subagents: [
        {
          key: "sub-1",
          label: "QA",
          status: "running",
          model: "claude-opus-4-6",
          startedAt: Date.now(),
          endedAt: null,
          durationMs: 0,
          tokens: null,
          error: null,
        },
      ],
    });
    render(<AgentCard agent={agent} />);
    expect(screen.getByText("1 active subagent")).toBeInTheDocument();
  });

  it("does not show subagent section when no subagents", () => {
    const agent = createMockAgent({ subagents: [] });
    render(<AgentCard agent={agent} />);
    expect(screen.queryByText(/active subagent/)).not.toBeInTheDocument();
  });

  it("shows channel bindings", () => {
    const agent = createMockAgent({
      bindings: [
        { channelType: "telegram", channelId: "tg-1", bound: true },
        { channelType: "discord", channelId: "dc-1", bound: true },
      ],
    });
    render(<AgentCard agent={agent} />);
    expect(screen.getByText("telegram")).toBeInTheDocument();
    expect(screen.getByText("discord")).toBeInTheDocument();
  });

  it("links to agent detail page", () => {
    const agent = createMockAgent({ id: "brokkr" });
    render(<AgentCard agent={agent} />);
    const link = document.querySelector('a[href="/agent/$agentId"]');
    expect(link).toBeInTheDocument();
  });
});
