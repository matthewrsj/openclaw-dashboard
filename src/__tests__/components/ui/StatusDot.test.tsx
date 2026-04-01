import { describe, it, expect } from "vitest";
import { render } from "../../helpers/render";
import { StatusDot } from "@/components/ui/StatusDot";

describe("StatusDot", () => {
  it("renders a success dot with green color", () => {
    const { container } = render(<StatusDot status="success" />);
    const dot = container.firstChild as HTMLElement;
    expect(dot.className).toContain("bg-status-success");
    expect(dot.className).toContain("rounded-full");
  });

  it("renders a warning dot with amber color", () => {
    const { container } = render(<StatusDot status="warning" />);
    const dot = container.firstChild as HTMLElement;
    expect(dot.className).toContain("bg-status-warning");
  });

  it("renders an error dot with red color", () => {
    const { container } = render(<StatusDot status="error" />);
    const dot = container.firstChild as HTMLElement;
    expect(dot.className).toContain("bg-status-error");
  });

  it("renders an inactive dot with tertiary color", () => {
    const { container } = render(<StatusDot status="inactive" />);
    const dot = container.firstChild as HTMLElement;
    expect(dot.className).toContain("bg-text-tertiary");
  });

  it("applies small size", () => {
    const { container } = render(<StatusDot status="success" size="sm" />);
    const dot = container.firstChild as HTMLElement;
    expect(dot.className).toContain("h-2");
    expect(dot.className).toContain("w-2");
  });

  it("applies medium size by default", () => {
    const { container } = render(<StatusDot status="success" />);
    const dot = container.firstChild as HTMLElement;
    expect(dot.className).toContain("h-3");
    expect(dot.className).toContain("w-3");
  });

  it("applies large size", () => {
    const { container } = render(<StatusDot status="success" size="lg" />);
    const dot = container.firstChild as HTMLElement;
    expect(dot.className).toContain("h-4");
    expect(dot.className).toContain("w-4");
  });

  it("applies pulse animation when pulse=true", () => {
    const { container } = render(<StatusDot status="success" pulse />);
    const dot = container.firstChild as HTMLElement;
    expect(dot.className).toContain("animate-pulse-dot");
  });

  it("does not apply pulse animation by default", () => {
    const { container } = render(<StatusDot status="success" />);
    const dot = container.firstChild as HTMLElement;
    expect(dot.className).not.toContain("animate-pulse-dot");
  });

  it("merges custom className", () => {
    const { container } = render(<StatusDot status="success" className="ml-2" />);
    const dot = container.firstChild as HTMLElement;
    expect(dot.className).toContain("ml-2");
  });
});
