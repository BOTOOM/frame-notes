import { describe, expect, it } from "vitest";
import {
  clampListHeight,
  minListHeight,
  resizeActionForKey,
} from "../apps/extension/src/panel-layout";

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

  it("maps resize keyboard commands and ignores modified shortcuts", () => {
    const key = (
      value: string,
      modifiers: Partial<{
        shiftKey: boolean;
        altKey: boolean;
        ctrlKey: boolean;
        metaKey: boolean;
      }> = {},
    ) => ({
      key: value,
      shiftKey: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      ...modifiers,
    });

    expect(resizeActionForKey(key("ArrowUp"))).toBe("resize-up");
    expect(resizeActionForKey(key("ArrowUp", { shiftKey: true }))).toBe("resize-up-fast");
    expect(resizeActionForKey(key("ArrowDown"))).toBe("resize-down");
    expect(resizeActionForKey(key("ArrowDown", { shiftKey: true }))).toBe("resize-down-fast");
    expect(resizeActionForKey(key("Home"))).toBe("resize-min");
    expect(resizeActionForKey(key("End"))).toBe("resize-max");
    expect(resizeActionForKey(key("Enter"))).toBe("resize-reset");
    expect(resizeActionForKey(key("ArrowDown", { ctrlKey: true }))).toBeNull();
    expect(resizeActionForKey(key("Escape"))).toBeNull();
  });
});
