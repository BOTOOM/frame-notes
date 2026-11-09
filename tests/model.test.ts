import { describe, expect, it } from "vitest";
import {
  chooseNotesDoc,
  copyText,
  emptyNotesDoc,
  formatRangeDuration,
  formatTime,
  framesAt,
  type Note,
  normalizeNote,
  notesJson,
  notesMarkdown,
  orderNotes,
  parseFps,
  parseTime,
  rangeDuration,
  restoreDeletedNotes,
  sortNotes,
} from "../apps/extension/src/model";

function note(id: string, start: number, end: number | null, text = id): Note {
  return {
    id,
    start,
    end,
    text,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("time formatting and parsing", () => {
  it("normalizes rounded millisecond boundaries", () => {
    expect(formatTime(0)).toBe("00:00.000");
    expect(formatTime(59.9996)).toBe("01:00.000");
    expect(formatTime(3600)).toBe("1:00:00.000");
  });

  it("parses seconds, clocks, and frame numbers", () => {
    expect(parseTime("12.500", 30)).toBe(12.5);
    expect(parseTime("02:12.500", 30)).toBe(132.5);
    expect(parseTime("1:02:03.250", 30)).toBe(3723.25);
    expect(parseTime("f123", 30)).toBe(4.1);
    expect(parseTime("f123", 29.97)).toBeCloseTo(4.1041, 4);
  });

  it("rejects malformed and out-of-range clock times", () => {
    expect(parseTime("", 30)).toBeNull();
    expect(parseTime("00:60.000", 30)).toBeNull();
    expect(parseTime("1:60:00", 30)).toBeNull();
    expect(parseTime("-1.2", 30)).toBeNull();
    expect(parseTime("nope", 30)).toBeNull();
  });

  it("reads fractional frame rates and computes rounded frames", () => {
    expect(parseFps("30000/1001")).toBeCloseTo(29.97003, 4);
    expect(framesAt(3.433, 29.97)).toBe(103);
  });
});

describe("notes documents", () => {
  it("swaps reversed ranges and keeps notes sorted", () => {
    const swapped = normalizeNote(note("range", 8, 3));
    expect(swapped).toMatchObject({ start: 3, end: 8 });
    expect(sortNotes([note("later", 8, null), note("earlier", 2, null)])).toMatchObject([
      { id: "earlier" },
      { id: "later" },
    ]);
  });

  it("orders display notes in either direction without mutating stable ties", () => {
    const input = [note("late", 5, null), note("tie-a", 2, null), note("tie-b", 2, null)];
    expect(orderNotes(input, "asc").map(({ id }) => id)).toEqual(["tie-a", "tie-b", "late"]);
    expect(orderNotes(input, "desc").map(({ id }) => id)).toEqual(["late", "tie-a", "tie-b"]);
    expect(input.map(({ id }) => id)).toEqual(["late", "tie-a", "tie-b"]);
    expect(orderNotes(input, "desc")).not.toBe(input);
  });

  it("restores deleted notes sorted without duplicating existing notes", () => {
    const current = [note("middle", 5, null)];
    const deleted = [note("late", 9, null), note("early", 1, null)];
    expect(restoreDeletedNotes(current, deleted).map(({ id }) => id)).toEqual([
      "early",
      "middle",
      "late",
    ]);
  });

  it("formats range duration in copy and Markdown without changing the JSON schema", () => {
    const doc = {
      ...emptyNotesDoc("demo"),
      fps: 30,
      notes: [
        note("point", 7, null, "Subir el volumen"),
        note("range", 3.433, 3.666, "Cambiar el título\nAñadir una sombra"),
      ],
    };
    expect(copyText(doc, "es")).toBe(
      "Notas de revisión — demo (2 notas, 30 fps)\n" +
        "1) 00:03.433 → 00:03.666 (f103–f110, 0.233 s): Cambiar el título\n   Añadir una sombra\n" +
        "2) 00:07.000 (f210): Subir el volumen",
    );
    const rangeNote = doc.notes.find((note) => note.id === "range");
    expect(rangeNote).toBeDefined();
    if (rangeNote) {
      expect(rangeDuration(rangeNote, 30)?.frames).toBe(7);
      expect(formatRangeDuration(rangeNote, 30)).toBe("0.233 s · 7 f");
    }
    expect(notesMarkdown(doc, "es")).toContain("Producido por Frame Notes");
    expect(notesMarkdown(doc, "es")).toContain(copyText(doc, "es"));
    expect(JSON.parse(notesJson(doc))).toMatchObject({ schemaVersion: 1, project: "demo" });
  });

  it("prefers the newer file and otherwise keeps newer local notes", () => {
    const local = {
      ...emptyNotesDoc("demo"),
      updatedAt: "2026-01-02T00:00:00.000Z",
    };
    const remote = {
      ...emptyNotesDoc("demo"),
      updatedAt: "2026-01-03T00:00:00.000Z",
    };
    expect(chooseNotesDoc(local, remote)).toBe(remote);
    expect(chooseNotesDoc(remote, local)).toBe(remote);
    expect(chooseNotesDoc(null, remote)).toBe(remote);
  });
});
