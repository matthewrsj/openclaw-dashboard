import { describe, it, expect, vi } from "vitest";
import { render, screen } from "../../helpers/render";
import userEvent from "@testing-library/user-event";
import { EmptyState } from "@/components/ui/EmptyState";

describe("EmptyState", () => {
  it("renders title", () => {
    render(<EmptyState title="No agents found" />);
    expect(screen.getByText("No agents found")).toBeInTheDocument();
  });

  it("renders description when provided", () => {
    render(<EmptyState title="Empty" description="Create your first agent" />);
    expect(screen.getByText("Create your first agent")).toBeInTheDocument();
  });

  it("does not render description when not provided", () => {
    const { container } = render(<EmptyState title="Empty" />);
    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs.length).toBe(0);
  });

  it("renders icon when provided", () => {
    render(<EmptyState title="Empty" icon={<span data-testid="icon">🤖</span>} />);
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("renders action button with label/onClick object", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <EmptyState
        title="Empty"
        action={{ label: "Create Agent", onClick }}
      />,
    );
    const btn = screen.getByRole("button", { name: "Create Agent" });
    expect(btn).toBeInTheDocument();
    await user.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("renders action as ReactNode", () => {
    render(
      <EmptyState
        title="Empty"
        action={<a href="/create">Create</a>}
      />,
    );
    expect(screen.getByText("Create")).toBeInTheDocument();
  });

  it("centers content", () => {
    const { container } = render(<EmptyState title="Empty" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("text-center");
    expect(wrapper.className).toContain("flex");
    expect(wrapper.className).toContain("items-center");
  });
});
