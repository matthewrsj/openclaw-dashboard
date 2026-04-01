import { describe, it, expect } from "vitest";
import { render, screen } from "../../helpers/render";
import { Badge } from "@/components/ui/Badge";

describe("Badge", () => {
  it("renders children", () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("applies default variant classes", () => {
    render(<Badge>Default</Badge>);
    const badge = screen.getByText("Default");
    expect(badge.className).toContain("bg-bg-secondary");
  });

  it("applies success variant classes", () => {
    render(<Badge variant="success">Success</Badge>);
    const badge = screen.getByText("Success");
    expect(badge.className).toContain("text-status-success");
  });

  it("applies warning variant classes", () => {
    render(<Badge variant="warning">Warning</Badge>);
    const badge = screen.getByText("Warning");
    expect(badge.className).toContain("text-status-warning");
  });

  it("applies error variant classes", () => {
    render(<Badge variant="error">Error</Badge>);
    const badge = screen.getByText("Error");
    expect(badge.className).toContain("text-status-error");
  });

  it("applies secondary variant classes", () => {
    render(<Badge variant="secondary">Secondary</Badge>);
    const badge = screen.getByText("Secondary");
    expect(badge.className).toContain("bg-bg-tertiary");
  });

  it("merges custom className", () => {
    render(<Badge className="my-class">Custom</Badge>);
    const badge = screen.getByText("Custom");
    expect(badge.className).toContain("my-class");
  });

  it("has correct base styles (rounded, inline-flex, text-xs)", () => {
    render(<Badge>Base</Badge>);
    const badge = screen.getByText("Base");
    expect(badge.className).toContain("rounded-md");
    expect(badge.className).toContain("inline-flex");
    expect(badge.className).toContain("text-xs");
  });
});
