import { describe, expect, it, vi } from "vitest";
import {
  type FetchLike,
  mergeNotes,
  needsMarkdownSync,
  putFile,
  syncProjectNotes,
} from "../apps/extension/src/file-sync";
import { emptyNotesDoc, notesMarkdown } from "../apps/extension/src/model";

describe("project file synchronization", () => {
  it("recovers a missing precondition with one If-Match retry", async () => {
    const fetcher = vi
      .fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ currentVersion: '"v2"' }), {
          status: 428,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ version: '"v3"' }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    await expect(putFile(fetcher, "demo", "review-notes.json", "{}", null)).resolves.toBe('"v3"');
    expect(fetcher).toHaveBeenCalledTimes(2);
    const first = fetcher.mock.calls[0][1];
    const second = fetcher.mock.calls[1][1];
    expect(new Headers(first?.headers).get("If-None-Match")).toBe("*");
    expect(new Headers(second?.headers).get("If-Match")).toBe('"v2"');
  });

  it("retries a 409 conflict with the current If-Match version", async () => {
    const fetcher = vi
      .fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ currentVersion: '"v2"', currentContent: "{}" }), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ version: '"v3"' }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    await expect(putFile(fetcher, "demo", "review-notes.json", "{}", '"v1"')).resolves.toBe('"v3"');
    expect(fetcher).toHaveBeenCalledTimes(2);
    const second = fetcher.mock.calls[1][1];
    expect(new Headers(second?.headers).get("If-Match")).toBe('"v2"');
    expect(new Headers(second?.headers).has("If-None-Match")).toBe(false);
  });

  it("retries a deleted-file 409 conflict with If-None-Match", async () => {
    const fetcher = vi
      .fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ currentVersion: null, currentContent: null }), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ version: '"v3"' }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    await expect(putFile(fetcher, "demo", "review-notes.json", "{}", '"v1"')).resolves.toBe('"v3"');
    expect(fetcher).toHaveBeenCalledTimes(2);
    const second = fetcher.mock.calls[1][1];
    expect(new Headers(second?.headers).get("If-None-Match")).toBe("*");
    expect(new Headers(second?.headers).has("If-Match")).toBe(false);
  });

  it("retries a null-version 428 precondition with If-None-Match", async () => {
    const fetcher = vi
      .fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ currentVersion: null }), {
          status: 428,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ version: '"v2"' }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    await expect(putFile(fetcher, "demo", "review-notes.json", "{}", '"v1"')).resolves.toBe('"v2"');
    expect(fetcher).toHaveBeenCalledTimes(2);
    const second = fetcher.mock.calls[1][1];
    expect(new Headers(second?.headers).get("If-None-Match")).toBe("*");
    expect(new Headers(second?.headers).has("If-Match")).toBe(false);
  });

  it("does not retry a precondition response more than once", async () => {
    const fetcher = vi
      .fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValue(
        new Response(JSON.stringify({ currentVersion: '"v2"' }), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        }),
      );
    await expect(putFile(fetcher, "demo", "review-notes.md", "# notes", null)).rejects.toThrow(
      "(409)",
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("uses the file-newer merge rule", () => {
    const local = { ...emptyNotesDoc("demo"), updatedAt: "2026-01-01T00:00:00.000Z" };
    const remote = { ...emptyNotesDoc("demo"), updatedAt: "2026-01-02T00:00:00.000Z" };
    expect(mergeNotes(local, remote)).toBe(remote);
    expect(mergeNotes(remote, local)).toBe(remote);
  });

  it("keeps both writers' notes when a JSON write conflicts", async () => {
    const localNote = {
      id: "local",
      start: 1,
      end: null,
      text: "local",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const remoteNote = { ...localNote, id: "remote", text: "remote" };
    const remoteDoc = {
      ...emptyNotesDoc("demo"),
      updatedAt: "2026-01-02T00:00:00.000Z",
      notes: [remoteNote],
    };
    let jsonWrites = 0;
    const fetcher: FetchLike = async (input, init) => {
      const url = String(input);
      if (init?.method !== "PUT") {
        if (url.endsWith("review-notes.json")) {
          return new Response(
            JSON.stringify({ content: JSON.stringify(remoteDoc), version: '"v2"' }),
            { headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response(null, { status: 404 });
      }
      if (url.endsWith("review-notes.json")) {
        jsonWrites += 1;
        if (jsonWrites === 1) {
          return new Response(JSON.stringify({ currentVersion: '"v2"' }), {
            status: 409,
            headers: { "Content-Type": "application/json" },
          });
        }
        const saved = JSON.parse(String(init.body)) as { notes: unknown[] };
        expect(saved.notes).toHaveLength(2);
        return new Response(JSON.stringify({ version: '"v3"' }), {
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ version: '"v4"' }), {
        headers: { "Content-Type": "application/json" },
      });
    };
    const doc = { ...emptyNotesDoc("demo"), notes: [localNote] };
    const merged = await syncProjectNotes(
      doc,
      new Map([["review-notes.json", '"v1"']]),
      "en",
      fetcher,
    );
    expect(merged.notes.map((note) => note.id).sort()).toEqual(["local", "remote"]);
  });

  it("does not resurrect a locally deleted note after a conflict", () => {
    const deleted = {
      id: "deleted",
      start: 1,
      end: null,
      text: "deleted",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const local = { ...emptyNotesDoc("demo"), notes: [] };
    const remote = { ...emptyNotesDoc("demo"), notes: [deleted] };
    expect(mergeNotes(local, remote, new Set(["deleted"]))?.notes).toEqual([]);
  });

  it("repairs missing or stale Markdown for the selected JSON document", () => {
    const doc = emptyNotesDoc("demo");
    expect(needsMarkdownSync(null, doc, "en")).toBe(true);
    expect(needsMarkdownSync("# stale", doc, "en")).toBe(true);
    expect(needsMarkdownSync(notesMarkdown(doc, "en"), doc, "en")).toBe(false);
  });
});
