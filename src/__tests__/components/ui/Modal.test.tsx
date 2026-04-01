import { describe, it, expect, vi } from "vitest";
import { render, screen } from "../../helpers/render";
import userEvent from "@testing-library/user-event";
import { Modal } from "@/components/ui/Modal";

describe("Modal", () => {
  it("renders children when open", () => {
    render(
      <Modal open onClose={() => {}}>
        <p>Modal content</p>
      </Modal>,
    );
    expect(screen.getByText("Modal content")).toBeInTheDocument();
  });

  it("does not render when not open", () => {
    render(
      <Modal open={false} onClose={() => {}}>
        <p>Hidden content</p>
      </Modal>,
    );
    expect(screen.queryByText("Hidden content")).not.toBeInTheDocument();
  });

  it("supports isOpen prop for backwards compat", () => {
    render(
      <Modal isOpen onClose={() => {}}>
        <p>Legacy open</p>
      </Modal>,
    );
    expect(screen.getByText("Legacy open")).toBeInTheDocument();
  });

  it("renders title when provided", () => {
    render(
      <Modal open onClose={() => {}} title="My Title">
        Content
      </Modal>,
    );
    expect(screen.getByText("My Title")).toBeInTheDocument();
  });

  it("renders footer when provided", () => {
    render(
      <Modal open onClose={() => {}} footer={<button>Save</button>}>
        Content
      </Modal>,
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("calls onClose when backdrop clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose}>
        Content
      </Modal>,
    );
    // The backdrop is the fixed overlay div
    const backdrop = document.querySelector(".fixed.inset-0.bg-black\\/50");
    if (backdrop) {
      await user.click(backdrop);
      expect(onClose).toHaveBeenCalledOnce();
    }
  });

  it("does not call onClose on backdrop click when preventClose is true", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} preventClose>
        Content
      </Modal>,
    );
    const backdrop = document.querySelector(".fixed.inset-0.bg-black\\/50");
    if (backdrop) {
      await user.click(backdrop);
      expect(onClose).not.toHaveBeenCalled();
    }
  });

  it("applies size classes", () => {
    const { rerender } = render(
      <Modal open onClose={() => {}} size="sm">
        Small
      </Modal>,
    );
    expect(document.querySelector(".w-\\[480px\\]")).toBeInTheDocument();

    rerender(
      <Modal open onClose={() => {}} size="lg">
        Large
      </Modal>,
    );
    expect(document.querySelector(".w-\\[800px\\]")).toBeInTheDocument();
  });
});
