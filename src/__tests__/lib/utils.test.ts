import { describe, it, expect, vi } from "vitest";
import { cn, uniqueId, debounce, clamp } from "@/lib/utils";

describe("cn (classname utility)", () => {
  it("joins string classes", () => {
    expect(cn("a", "b", "c")).toBe("a b c");
  });

  it("filters out falsy values", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });

  it("handles object notation", () => {
    expect(cn({ active: true, disabled: false })).toBe("active");
  });

  it("mixes strings and objects", () => {
    expect(cn("base", { active: true, hidden: false })).toBe("base active");
  });

  it("returns empty string for no args", () => {
    expect(cn()).toBe("");
  });
});

describe("uniqueId", () => {
  it("generates unique IDs", () => {
    const id1 = uniqueId();
    const id2 = uniqueId();
    expect(id1).not.toBe(id2);
  });

  it("applies prefix", () => {
    const id = uniqueId("msg-");
    expect(id.startsWith("msg-")).toBe(true);
  });
});

describe("debounce", () => {
  it("delays function execution", async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    debounced();
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("resets timer on subsequent calls", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    debounced();
    vi.advanceTimersByTime(50);
    debounced();
    vi.advanceTimersByTime(50);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});

describe("clamp", () => {
  it("clamps value below min", () => {
    expect(clamp(-5, 0, 100)).toBe(0);
  });

  it("clamps value above max", () => {
    expect(clamp(150, 0, 100)).toBe(100);
  });

  it("returns value within range", () => {
    expect(clamp(50, 0, 100)).toBe(50);
  });

  it("handles min === max", () => {
    expect(clamp(50, 10, 10)).toBe(10);
  });
});
