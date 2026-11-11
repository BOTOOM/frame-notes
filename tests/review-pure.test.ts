import { describe, expect, it } from "vitest";
import { reviewExportName } from "../apps/extension/src/review/export-name";
import { estimateFps } from "../apps/extension/src/review/fps";
import {
  clampTimelineZoom,
  reviewPixelsPerSecond,
  timelineTickInterval,
  visibleTimelineWindow,
} from "../apps/extension/src/review/timeline-math";
import { snapTime } from "../apps/extension/src/review/video-player";

describe("video frame-rate estimation", () => {
  it("estimates jittered 30 fps media", () => {
    const deltas = [0.0331, 0.0335, 0.0332, 0.0334, 0.0333, 0.0331, 0.0336, 0.0332, 0.0334, 0.0333];
    expect(estimateFps(deltas)).toBe(30);
  });

  it("snaps 29.97 and 25 fps to common rates", () => {
    expect(estimateFps(Array(12).fill(1001 / 30000))).toBe(29.97);
    expect(estimateFps(Array(12).fill(1 / 25))).toBe(25);
  });

  it("ignores non-positive and outlier deltas", () => {
    expect(estimateFps([...Array(12).fill(1 / 30), 0, -0.03, 0.2])).toBe(30);
  });

  it("waits for ten usable samples", () => {
    expect(estimateFps(Array(9).fill(1 / 30))).toBeNull();
  });
});

describe("local review helpers", () => {
  it("builds safe Markdown and JSON export names", () => {
    expect(reviewExportName("capture", "md")).toBe("capture.review-notes.md");
    expect(reviewExportName("screen.capture.final.mp4", "json")).toBe(
      "screen.capture.final.review-notes.json",
    );
    expect(reviewExportName("a/bad:name?.mp4", "md")).toBe("bad-name.review-notes.md");
  });

  it("clamps zoom from fit-all to a two-second window", () => {
    expect(clampTimelineZoom(0.5, 100)).toBe(1);
    expect(clampTimelineZoom(500, 100)).toBe(50);
    expect(clampTimelineZoom(8, 10)).toBe(5);
    expect(reviewPixelsPerSecond(800, 100, 50)).toBe(400);
  });

  it("chooses readable tick intervals and computes the visible window", () => {
    expect(timelineTickInterval(100)).toBe(1);
    expect(timelineTickInterval(0.5)).toBe(300);
    expect(visibleTimelineWindow(20, 80, 10, 100)).toEqual({ start: 2, end: 10 });
  });

  it("snaps seeks to the nearest frame and clamps to duration", () => {
    expect(snapTime(1.02, 30, 10)).toBeCloseTo(31 / 30);
    expect(snapTime(10.1, 30, 10)).toBe(10);
  });
});
