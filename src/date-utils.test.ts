import { describe, it, expect } from "vitest";
import {
  formatDate,
  formatDisplayDate,
  parseDate,
  isOverdue,
  isDueOn,
  slugify,
} from "./date-utils";

describe("formatDate", () => {
  it("formats a date as YYYY-MM-DD", () => {
    expect(formatDate(new Date(2026, 3, 13))).toBe("2026-04-13");
  });

  it("pads single-digit month and day", () => {
    expect(formatDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("handles December correctly", () => {
    expect(formatDate(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});

describe("formatDisplayDate", () => {
  it("formats a date for display", () => {
    const result = formatDisplayDate(new Date(2026, 3, 13));
    // en-AU locale: "Monday, 13 April 2026"
    expect(result).toContain("13");
    expect(result).toContain("April");
    expect(result).toContain("2026");
  });
});

describe("parseDate", () => {
  it("parses YYYY-MM-DD string", () => {
    const d = parseDate("2026-04-13");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(3); // 0-indexed
    expect(d!.getDate()).toBe(13);
  });

  it("returns null for invalid format", () => {
    expect(parseDate("not-a-date")).toBeNull();
    expect(parseDate("2026/04/13")).toBeNull();
    expect(parseDate("")).toBeNull();
  });

  it("round-trips with formatDate", () => {
    const original = new Date(2026, 3, 13);
    const parsed = parseDate(formatDate(original));
    expect(parsed!.getFullYear()).toBe(original.getFullYear());
    expect(parsed!.getMonth()).toBe(original.getMonth());
    expect(parsed!.getDate()).toBe(original.getDate());
  });
});

describe("isOverdue", () => {
  it("returns true when due date is before today", () => {
    expect(isOverdue("2026-04-10", "2026-04-13")).toBe(true);
  });

  it("returns false when due date is today", () => {
    expect(isOverdue("2026-04-13", "2026-04-13")).toBe(false);
  });

  it("returns false when due date is in the future", () => {
    expect(isOverdue("2026-04-15", "2026-04-13")).toBe(false);
  });

  it("handles month boundaries", () => {
    expect(isOverdue("2026-03-31", "2026-04-01")).toBe(true);
  });
});

describe("isDueOn", () => {
  it("returns true when dates match", () => {
    expect(isDueOn("2026-04-13", "2026-04-13")).toBe(true);
  });

  it("returns false when dates differ", () => {
    expect(isDueOn("2026-04-14", "2026-04-13")).toBe(false);
  });
});

describe("slugify", () => {
  it("converts to lowercase kebab-case", () => {
    expect(slugify("Kingdom of God")).toBe("kingdom-of-god");
  });

  it("handles already-slugified input", () => {
    expect(slugify("team-gill")).toBe("team-gill");
  });

  it("strips leading and trailing hyphens", () => {
    expect(slugify(" Hello World ")).toBe("hello-world");
  });

  it("handles single words", () => {
    expect(slugify("Theosis")).toBe("theosis");
  });

  it("handles special characters", () => {
    expect(slugify("Family & Friends")).toBe("family-friends");
  });

  it("collapses multiple separators", () => {
    expect(slugify("one   two---three")).toBe("one-two-three");
  });
});
