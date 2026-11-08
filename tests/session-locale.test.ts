import { afterEach, describe, expect, it, vi } from "vitest";
import type { FetchLike } from "../apps/extension/src/file-sync";
import { emptyNotesDoc, type NotesDoc, notesMarkdown } from "../apps/extension/src/model";
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

interface ProjectFiles {
  doc: NotesDoc | null;
  markdown: string | null;
  jsonVersion: string | null;
  markdownVersion: string | null;
}

interface FileWrite {
  path: string;
  body: string;
}

function createProjectFetcher(doc: NotesDoc | null, markdown: string | null) {
  const files: ProjectFiles = {
    doc,
    markdown,
    jsonVersion: doc ? '"json-v1"' : null,
    markdownVersion: markdown === null ? null : '"md-v1"',
  };
  const writes: FileWrite[] = [];
  let version = 2;
  const fetcher: FetchLike = async (input, init) => {
    const url = String(input);
    const isJson = url.endsWith("review-notes.json");
    const path = isJson ? "review-notes.json" : "review-notes.md";
    if (init?.method === "PUT") {
      const body = String(init.body);
      writes.push({ path, body });
      const nextVersion = `"${isJson ? "json" : "md"}-v${version++}"`;
      if (isJson) {
        files.doc = JSON.parse(body) as NotesDoc;
        files.jsonVersion = nextVersion;
      } else {
        files.markdown = body;
        files.markdownVersion = nextVersion;
      }
      return new Response(JSON.stringify({ version: nextVersion }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const content = isJson ? (files.doc ? JSON.stringify(files.doc) : null) : files.markdown;
    if (content === null) return new Response(null, { status: 404 });
    const currentVersion = isJson ? files.jsonVersion : files.markdownVersion;
    return new Response(JSON.stringify({ content, version: currentVersion }), {
      headers: { "Content-Type": "application/json" },
    });
  };

  return { files, fetcher, writes };
}

describe("NoteSession locale changes", () => {
  it("uses remote notes for Markdown without rewriting stale local JSON", async () => {
    const note = {
      id: "stale",
      start: 1,
      end: null,
      text: "Stale note X",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const staleDoc = { ...emptyNotesDoc("demo"), notes: [note] };
    const { files, fetcher, writes } = createProjectFetcher(
      staleDoc,
      notesMarkdown(staleDoc, "en"),
    );
    vi.stubGlobal("fetch", fetcher);
    const session = new NoteSession("demo", "http://localhost", () => undefined, "en");
    await session.load();
    expect(session.getDocumentSnapshot().notes).toEqual([note]);

    const remoteDoc = emptyNotesDoc("demo");
    files.doc = remoteDoc;
    files.markdown = notesMarkdown(remoteDoc, "en");
    files.jsonVersion = '"json-v2"';
    files.markdownVersion = '"md-v2"';
    await session.setLocale("es");

    expect(writes.map(({ path }) => path)).toEqual(["review-notes.md"]);
    expect(writes[0]?.body).toBe(notesMarkdown(remoteDoc, "es"));
    expect(writes[0]?.body).not.toContain(note.text);
    session.dispose();
  });

  it("rewrites an existing Markdown file when switching locale with no notes", async () => {
    const doc = emptyNotesDoc("demo");
    const { fetcher, writes } = createProjectFetcher(doc, notesMarkdown(doc, "es"));
    vi.stubGlobal("fetch", fetcher);
    const session = new NoteSession("demo", "http://localhost", () => undefined, "es");
    await session.load();

    await session.setLocale("en");

    expect(writes).toEqual([{ path: "review-notes.md", body: notesMarkdown(doc, "en") }]);
    session.dispose();
  });

  it("does not create Markdown when an empty project has no Markdown file", async () => {
    const { fetcher, writes } = createProjectFetcher(null, null);
    vi.stubGlobal("fetch", fetcher);
    const session = new NoteSession("demo", "http://localhost", () => undefined, "es");
    await session.load();

    await session.setLocale("en");

    expect(writes).toEqual([]);
    session.dispose();
  });

  it("publishes an error when the Markdown-only sync fails", async () => {
    const doc = emptyNotesDoc("demo");
    const { fetcher: readFetcher } = createProjectFetcher(doc, notesMarkdown(doc, "es"));
    const fetcher: FetchLike = async (input, init) => {
      if (init?.method === "PUT") return new Response(null, { status: 500 });
      return readFetcher(input, init);
    };
    vi.stubGlobal("fetch", fetcher);
    const session = new NoteSession("demo", "http://localhost", () => undefined, "es");
    await session.load();

    await session.setLocale("en");

    expect(session.getSyncStatusSnapshot()).toBe("error");
    session.dispose();
  });

  it("uses a pending local write to render Markdown in the new locale", async () => {
    const doc = emptyNotesDoc("demo");
    const note = {
      id: "one",
      start: 1,
      end: null,
      text: "Review this",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const { fetcher, writes } = createProjectFetcher(doc, notesMarkdown(doc, "en"));
    vi.stubGlobal("fetch", fetcher);
    vi.useFakeTimers();
    const session = new NoteSession("demo", "http://localhost", () => undefined, "en");
    await session.load();

    session.updateNotes([note]);
    await session.setLocale("es");
    expect(writes).toEqual([]);
    await vi.advanceTimersByTimeAsync(800);

    expect(writes.map(({ path }) => path)).toEqual(["review-notes.json", "review-notes.md"]);
    expect(writes[1]?.body).toBe(notesMarkdown({ ...doc, notes: [note] }, "es"));
    await session.setLocale("en");

    expect(writes.map(({ path }) => path)).toEqual([
      "review-notes.json",
      "review-notes.md",
      "review-notes.md",
    ]);
    expect(writes[2]?.body).toBe(notesMarkdown({ ...doc, notes: [note] }, "en"));
    session.dispose();
  });
});
