import { describe, it, expect } from "vitest";
import {
  formatRelativeTime,
  formatDuration,
  formatTokens,
  formatCost,
  formatPercent,
  formatNumber,
  formatBytes,
} from "@/lib/format";

describe("formatRelativeTime", () => {
  it("shows 'just now' for < 60 seconds", () => {
    expect(formatRelativeTime(Date.now() - 30000)).toBe("just now");
  });

  it("shows minutes for < 60 minutes", () => {
    expect(formatRelativeTime(Date.now() - 300000)).toBe("5m ago");
  });

  it("shows hours for < 24 hours", () => {
    expect(formatRelativeTime(Date.now() - 7200000)).toBe("2h ago");
  });

  it("shows days for < 7 days", () => {
    expect(formatRelativeTime(Date.now() - 172800000)).toBe("2d ago");
  });

  it("shows date for >= 7 days", () => {
    const result = formatRelativeTime(Date.now() - 864000000); // 10 days
    expect(result).not.toContain("ago");
    // Should be a date string
    expect(result).toMatch(/\d/);
  });
});

describe("formatDuration", () => {
  it("formats seconds", () => {
    expect(formatDuration(5000)).toBe("5s");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration(125000)).toBe("2m 5s");
  });

  it("formats hours and minutes", () => {
    expect(formatDuration(3720000)).toBe("1h 2m");
  });

  it("handles zero", () => {
    expect(formatDuration(0)).toBe("0s");
  });
});

describe("formatTokens", () => {
  it("shows raw number below 1000", () => {
    expect(formatTokens(500)).toBe("500");
  });

  it("shows K suffix for thousands", () => {
    expect(formatTokens(5000)).toBe("5.0K");
  });

  it("shows K suffix with decimal", () => {
    expect(formatTokens(15500)).toBe("15.5K");
  });

  it("shows M suffix for millions", () => {
    expect(formatTokens(1500000)).toBe("1.5M");
  });
});

describe("formatCost", () => {
  it("formats normal USD amounts", () => {
    expect(formatCost(2.4)).toBe("$2.40");
  });

  it("formats zero", () => {
    expect(formatCost(0)).toBe("$0.00¢"); // < 0.01 path
  });

  it("formats small amounts in cents", () => {
    expect(formatCost(0.005)).toBe("$0.50¢");
  });

  it("formats dollar amounts", () => {
    expect(formatCost(10.5)).toBe("$10.50");
  });
});

describe("formatPercent", () => {
  it("formats ratio to percentage", () => {
    expect(formatPercent(0.5)).toBe("50.0%");
  });

  it("formats small percentages", () => {
    expect(formatPercent(0.005)).toBe("0.5%");
  });

  it("formats 100%", () => {
    expect(formatPercent(1)).toBe("100.0%");
  });
});

describe("formatNumber", () => {
  it("formats with thousand separators", () => {
    const result = formatNumber(1234567);
    expect(result).toContain("1");
    expect(result).toContain("234");
    expect(result).toContain("567");
  });
});

describe("formatBytes", () => {
  it("formats bytes", () => {
    expect(formatBytes(500)).toBe("500.0 B");
  });

  it("formats kilobytes", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
  });

  it("formats megabytes", () => {
    expect(formatBytes(1048576)).toBe("1.0 MB");
  });

  it("formats gigabytes", () => {
    expect(formatBytes(1073741824)).toBe("1.0 GB");
  });
});
