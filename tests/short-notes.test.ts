import { describe, expect, it } from "vitest";
import {
  chunkPcm,
  insertAtCaret,
  joinPcmChunks,
  selectDictationEngine,
  speechLanguageCandidates,
} from "../apps/extension/src/dictation/helpers";
import { detailWindow, nudgeFrames, timeToX, xToTime } from "../apps/extension/src/timeline-math";

describe("timeline detail math", () => {
  it("centers and clamps detail windows to the composition", () => {
    expect(detailWindow(5, 4, 20)).toEqual({ start: 3, end: 7 });
    expect(detailWindow(1, 4, 20)).toEqual({ start: 0, end: 4 });
    expect(detailWindow(19, 4, 20)).toEqual({ start: 16, end: 20 });
    expect(detailWindow(5, 30, 10)).toEqual({ start: 0, end: 10 });
  });

  it("maps times to pixels and clamps scrubbing at both ends", () => {
    const window = { start: 2, end: 6 };
    expect(xToTime(300, 100, 400, window)).toBe(4);
    expect(xToTime(50, 100, 400, window)).toBe(2);
    expect(xToTime(550, 100, 400, window)).toBe(6);
    expect(timeToX(4, 100, 400, window)).toBe(300);
    expect(timeToX(0, 100, 400, window)).toBe(100);
    expect(timeToX(10, 100, 400, window)).toBe(500);
  });

  it("nudges by whole frames and clamps to the duration", () => {
    expect(nudgeFrames(3.433, 1, 30, 10)).toBeCloseTo(104 / 30);
    expect(nudgeFrames(3.433, -1, 30, 10)).toBeCloseTo(102 / 30);
    expect(nudgeFrames(0, -10, 30, 10)).toBe(0);
    expect(nudgeFrames(9.9, 10, 30, 10)).toBe(10);
  });
});

describe("local dictation helpers", () => {
  it("keeps regional speech languages before default mappings", () => {
    expect(speechLanguageCandidates("es", ["es-CO", "es", "en-US", "en"])).toEqual([
      "es-CO",
      "es-ES",
      "en-US",
    ]);
    expect(speechLanguageCandidates("en", ["en-GB", "es-CO"])).toEqual(["en-GB", "en-US", "es-CO"]);
  });

  it("selects local Chrome in auto mode and makes unsupported choices explicit", () => {
    expect(selectDictationEngine("auto", true)).toBe("chrome-local");
    expect(selectDictationEngine("auto", false)).toBe("whisper");
    expect(selectDictationEngine("chrome-local", false)).toBe("unsupported");
    expect(selectDictationEngine("whisper", false)).toBe("whisper");
  });

  it("chunks and reassembles PCM samples without loss", () => {
    const samples = new Float32Array([-1, -0.25, 0, 0.5, 1]);
    const chunks = chunkPcm(samples, 2);
    expect(chunks.map((chunk) => Array.from(chunk))).toEqual([[-1, -0.25], [0, 0.5], [1]]);
    expect(joinPcmChunks(chunks)).toEqual(samples);
  });

  it("inserts speech at the caret or replaces the selected text with spacing", () => {
    expect(insertAtCaret("hello", "again", 5)).toEqual({ value: "hello again", caret: 11 });
    expect(insertAtCaret("hello world", "there", 6, 11)).toEqual({
      value: "hello there",
      caret: 11,
    });
    expect(insertAtCaret("hello, world", "again", 6, 6).value).toBe("hello, again world");
  });
});
