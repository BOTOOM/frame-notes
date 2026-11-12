import { describe, expect, it } from "vitest";
import { isInteractiveShortcutTarget } from "../apps/extension/src/review/shortcut-target";

describe("review keyboard shortcut targets", () => {
  it("reserves Space for native and ARIA interactive elements", () => {
    for (const tagName of ["A", "BUTTON", "INPUT", "SELECT", "SUMMARY", "TEXTAREA"]) {
      expect(isInteractiveShortcutTarget(tagName, null)).toBe(true);
    }
    expect(isInteractiveShortcutTarget("div", "button")).toBe(true);
    expect(isInteractiveShortcutTarget("div", null)).toBe(false);
  });
});
