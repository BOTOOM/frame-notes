import { describe, expect, it } from "vitest";
import { clampPanelHeight, minPanelHeight } from "../apps/extension/src/panel-layout";

describe("panel height", () => {
  it("keeps a height that fits the available viewport", () => {
    expect(clampPanelHeight(360.7, 100, 800, 12)).toBe(361);
  });

  it("enforces the minimum height", () => {
    expect(clampPanelHeight(100, 100, 800, 12)).toBe(minPanelHeight);
  });

  it("limits height to the room below the panel top", () => {
    expect(clampPanelHeight(600, 500, 800, 12)).toBe(288);
  });

  it("uses the available viewport height when the viewport is too short", () => {
    expect(clampPanelHeight(300, 10, 200, 12)).toBe(176);
    expect(clampPanelHeight(300, 10, 20, 12)).toBe(0);
  });
});
