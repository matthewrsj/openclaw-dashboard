import { describe, it, expect } from "vitest";
import { cronToHuman, formatSchedule } from "@/services/cron-expression";

describe("cronToHuman", () => {
  it("converts simple daily cron", () => {
    const result = cronToHuman("0 9 * * *");
    expect(result.toLowerCase()).toContain("9:00");
  });

  it("converts multiple hours cron", () => {
    const result = cronToHuman("0 8,12,17 * * *");
    // Should mention all three times
    expect(result).toContain("8");
    expect(result).toContain("12");
    expect(result).toContain("5"); // 17 → 5 PM in 12h format
  });

  it("converts every minute cron", () => {
    const result = cronToHuman("* * * * *");
    expect(result.toLowerCase()).toContain("every minute");
  });

  it("converts every 5 minutes cron", () => {
    const result = cronToHuman("*/5 * * * *");
    expect(result.toLowerCase()).toContain("5");
  });

  it("converts weekday-only cron", () => {
    const result = cronToHuman("0 9 * * 1-5");
    expect(result.toLowerCase()).toContain("monday");
  });

  it("returns raw expression for invalid cron", () => {
    const result = cronToHuman("not a cron");
    expect(result).toBe("not a cron");
  });

  it("handles empty string", () => {
    const result = cronToHuman("");
    expect(result).toBe("");
  });
});

describe("formatSchedule", () => {
  it("combines human-readable schedule with timezone", () => {
    const result = formatSchedule("0 9 * * *", "America/Los_Angeles");
    expect(result).toContain("9:00");
    expect(result).toContain("America/Los_Angeles");
  });

  it("wraps timezone in parentheses", () => {
    const result = formatSchedule("* * * * *", "UTC");
    expect(result).toContain("(UTC)");
  });
});
