import { describe, it, expect } from "vitest";
import { render, screen } from "../../helpers/render";
import { ProgressBar } from "@/components/ui/ProgressBar";

describe("ProgressBar", () => {
  it("renders with the correct ARIA attributes", () => {
    render(<ProgressBar value={50} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "50");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
  });

  it("clamps value to 0-100 range", () => {
    const { rerender } = render(<ProgressBar value={-10} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");

    rerender(<ProgressBar value={150} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  });

  it("shows success color (green) below 80%", () => {
    const { container } = render(<ProgressBar value={50} />);
    const fill = container.querySelector("[style]") as HTMLElement;
    expect(fill.className).toContain("bg-status-success");
    expect(fill.style.width).toBe("50%");
  });

  it("shows warning color (amber) at 80%", () => {
    const { container } = render(<ProgressBar value={80} />);
    const fill = container.querySelector("[style]") as HTMLElement;
    expect(fill.className).toContain("bg-status-warning");
  });

  it("shows warning color at 94%", () => {
    const { container } = render(<ProgressBar value={94} />);
    const fill = container.querySelector("[style]") as HTMLElement;
    expect(fill.className).toContain("bg-status-warning");
  });

  it("shows critical color (red) at 95%", () => {
    const { container } = render(<ProgressBar value={95} />);
    const fill = container.querySelector("[style]") as HTMLElement;
    expect(fill.className).toContain("bg-status-error");
  });

  it("shows critical color at 100%", () => {
    const { container } = render(<ProgressBar value={100} />);
    const fill = container.querySelector("[style]") as HTMLElement;
    expect(fill.className).toContain("bg-status-error");
  });

  it("does not show label by default", () => {
    render(<ProgressBar value={50} />);
    expect(screen.queryByText("50%")).not.toBeInTheDocument();
  });

  it("shows label when showLabel=true", () => {
    render(<ProgressBar value={50} showLabel />);
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("renders small size by default", () => {
    const { container } = render(<ProgressBar value={50} />);
    const track = screen.getByRole("progressbar");
    expect(track.className).toContain("h-1.5");
  });

  it("renders medium size", () => {
    const { container } = render(<ProgressBar value={50} size="md" />);
    const track = screen.getByRole("progressbar");
    expect(track.className).toContain("h-2");
  });
});
