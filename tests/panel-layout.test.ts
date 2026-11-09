import { describe, expect, it } from "vitest";
import { clampListHeight, minListHeight } from "../apps/extension/src/panel-layout";

describe("panel list height", () => {
  it("rounds a height that fits the available space", () => {
    expect(clampListHeight(160.7, 500)).toBe(161);
  });

  it("enforces the minimum list height", () => {
    expect(clampListHeight(50, 500)).toBe(minListHeight);
  });

  it("limits height to the available space", () => {
    expect(clampListHeight(300, 200)).toBe(200);
  });

  it("allows heights below the minimum when less space is available", () => {
    expect(clampListHeight(200, 80.4)).toBe(80);
    expect(clampListHeight(200, -2)).toBe(0);
  });
});
