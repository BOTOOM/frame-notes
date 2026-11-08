import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyNotesDoc, notesMarkdown } from "../apps/extension/src/model";
import { NoteSession } from "../apps/extension/src/session";

vi.mock("wxt/utils/storage", () => ({
  storage: {
    getItem: async () => null,
    setItem: async () => undefined,
  },
}));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("NoteSession locale changes", () => {
  it("writes Markdown in the newly selected language", async () => {
    const note = {
      id: "one",
      start: 1,
      end: null,
      text: "Review this",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const doc = { ...emptyNotesDoc("demo"), notes: [note] };
    let markdownWrite = "";
    let resolveMarkdownWrite!: () => void;
    const markdownWriteCompleted = new Promise<void>((resolve) => {
      resolveMarkdownWrite = resolve;
    });
    const fetcher: typeof fetch = async (input, init) => {
      const url = String(input);
      if (init?.method === "PUT") {
        if (url.endsWith("review-notes.md")) {
          markdownWrite = String(init.body);
          resolveMarkdownWrite();
        }
        return new Response(JSON.stringify({ version: "next" }), {
          headers: { "Content-Type": "application/json" },
        });
      }
      const content = url.endsWith("review-notes.json")
        ? JSON.stringify(doc)
        : notesMarkdown(doc, "en");
      return new Response(JSON.stringify({ content, version: "current" }), {
        headers: { "Content-Type": "application/json" },
      });
    };
    vi.stubGlobal("fetch", fetcher);
    vi.useFakeTimers();
    const session = new NoteSession("demo", "http://localhost", () => undefined, "en");
    await session.load();
    session.setLocale("es");
    await vi.advanceTimersByTimeAsync(800);
    await markdownWriteCompleted;
    expect(markdownWrite).toContain("Producido por Frame Notes");
    expect(markdownWrite).toContain("Notas de revisión");
    session.dispose();
  });
});
