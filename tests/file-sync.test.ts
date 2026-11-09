import { describe, expect, it, vi } from "vitest";
import {
  type FetchLike,
  mergeNotes,
  needsMarkdownSync,
  putFile,
  syncProjectMarkdown,
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

  it("uses the latest locale for Markdown during a pending notes write", async () => {
    const doc = emptyNotesDoc("demo");
    let locale: "en" | "es" = "en";
    let markdownWrite = "";
    const fetcher: FetchLike = async (input, init) => {
      const url = String(input);
      if (url.endsWith("review-notes.json")) locale = "es";
      else markdownWrite = String(init?.body);
      return new Response(JSON.stringify({ version: '"v2"' }), {
        headers: { "Content-Type": "application/json" },
      });
    };

    await syncProjectNotes(
      doc,
      new Map([
        ["review-notes.json", '"json-v1"'],
        ["review-notes.md", '"md-v1"'],
      ]),
      () => locale,
      fetcher,
    );

    expect(markdownWrite).toBe(notesMarkdown(doc, "es"));
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

  it("keeps all locally deleted notes out of a conflict merge", () => {
    const deleted = ["first", "second"].map((id, index) => ({
      id,
      start: index + 1,
      end: null,
      text: id,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }));
    const local = { ...emptyNotesDoc("demo"), notes: [] };
    const remote = { ...emptyNotesDoc("demo"), notes: deleted };
    expect(mergeNotes(local, remote, new Set(deleted.map((note) => note.id)))?.notes).toEqual([]);
  });

  it("repairs missing or stale Markdown for the selected JSON document", () => {
    const doc = emptyNotesDoc("demo");
    expect(needsMarkdownSync(null, doc, "en")).toBe(true);
    expect(needsMarkdownSync("# stale", doc, "en")).toBe(true);
    expect(needsMarkdownSync(notesMarkdown(doc, "en"), doc, "en")).toBe(false);
  });

  it("rewrites only Markdown from the current remote document", async () => {
    const doc = emptyNotesDoc("demo");
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetcher: FetchLike = async (input, init) => {
      const url = String(input);
      requests.push({ url, init });
      if (init?.method === "PUT") {
        return new Response(JSON.stringify({ version: '"md-v2"' }), {
          headers: { "Content-Type": "application/json" },
        });
      }
      const content = url.endsWith("review-notes.json")
        ? JSON.stringify(doc)
        : notesMarkdown(doc, "es");
      const version = url.endsWith("review-notes.json") ? '"json-v1"' : '"md-v1"';
      return new Response(JSON.stringify({ content, version }), {
        headers: { "Content-Type": "application/json" },
      });
    };

    await syncProjectMarkdown("demo", "en", fetcher);

    const writes = requests.filter(({ init }) => init?.method === "PUT");
    expect(writes).toHaveLength(1);
    expect(writes[0].url).toContain("review-notes.md");
    expect(writes[0].init?.body).toBe(notesMarkdown(doc, "en"));
    expect(new Headers(writes[0].init?.headers).get("If-Match")).toBe('"md-v1"');
  });

  it("does not create Markdown for an untouched empty project", async () => {
    let writes = 0;
    const fetcher: FetchLike = async (_input, init) => {
      if (init?.method === "PUT") writes += 1;
      return new Response(null, { status: 404 });
    };

    await syncProjectMarkdown("demo", "en", fetcher);

    expect(writes).toBe(0);
  });

  it("does not overwrite Markdown when the remote JSON file is missing", async () => {
    let writes = 0;
    const fetcher: FetchLike = async (input, init) => {
      if (init?.method === "PUT") writes += 1;
      if (String(input).endsWith("review-notes.json")) {
        return new Response(null, { status: 404 });
      }
      return new Response(JSON.stringify({ content: "# Existing notes\n", version: '"md-v1"' }), {
        headers: { "Content-Type": "application/json" },
      });
    };

    await syncProjectMarkdown("demo", "en", fetcher);

    expect(writes).toBe(0);
  });

  it("does not create Markdown for a zero-note document without a Markdown file", async () => {
    const doc = emptyNotesDoc("demo");
    let writes = 0;
    const fetcher: FetchLike = async (input, init) => {
      if (init?.method === "PUT") writes += 1;
      if (String(input).endsWith("review-notes.json")) {
        return new Response(
          JSON.stringify({ content: JSON.stringify(doc), version: '"json-v1"' }),
          {
            headers: { "Content-Type": "application/json" },
          },
        );
      }
      return new Response(null, { status: 404 });
    };

    await syncProjectMarkdown("demo", "en", fetcher);

    expect(writes).toBe(0);
  });

  it("conditionally creates missing Markdown when the remote document has notes", async () => {
    const note = {
      id: "one",
      start: 1,
      end: null,
      text: "Review this",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const doc = { ...emptyNotesDoc("demo"), notes: [note] };
    let markdownWrite: RequestInit | undefined;
    const fetcher: FetchLike = async (input, init) => {
      const url = String(input);
      if (init?.method === "PUT") {
        markdownWrite = init;
        return new Response(JSON.stringify({ version: '"md-v1"' }), {
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.endsWith("review-notes.json")) {
        return new Response(
          JSON.stringify({ content: JSON.stringify(doc), version: '"json-v1"' }),
          { headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(null, { status: 404 });
    };

    await syncProjectMarkdown("demo", "en", fetcher);

    expect(markdownWrite?.body).toBe(notesMarkdown(doc, "en"));
    expect(new Headers(markdownWrite?.headers).get("If-None-Match")).toBe("*");
  });

  it("does not rewrite Markdown when it already matches the locale", async () => {
    const doc = emptyNotesDoc("demo");
    let writes = 0;
    const fetcher: FetchLike = async (input, init) => {
      if (init?.method === "PUT") writes += 1;
      const url = String(input);
      const content = url.endsWith("review-notes.json")
        ? JSON.stringify(doc)
        : notesMarkdown(doc, "en");
      return new Response(JSON.stringify({ content, version: '"v1"' }), {
        headers: { "Content-Type": "application/json" },
      });
    };

    await syncProjectMarkdown("demo", "en", fetcher);

    expect(writes).toBe(0);
  });

  it("rereads Markdown and retries once after a 428 conflict", async () => {
    const doc = emptyNotesDoc("demo");
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    let markdownReads = 0;
    let markdownWrites = 0;
    const fetcher: FetchLike = async (input, init) => {
      const url = String(input);
      requests.push({ url, init });
      if (init?.method === "PUT") {
        markdownWrites += 1;
        if (markdownWrites === 1) {
          return new Response(JSON.stringify({ currentVersion: '"md-v2"' }), {
            status: 428,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ version: '"md-v3"' }), {
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.endsWith("review-notes.json")) {
        return new Response(
          JSON.stringify({ content: JSON.stringify(doc), version: '"json-v1"' }),
          {
            headers: { "Content-Type": "application/json" },
          },
        );
      }
      markdownReads += 1;
      return new Response(
        JSON.stringify({
          content: `stale-${markdownReads}`,
          version: markdownReads === 1 ? '"md-v1"' : '"md-v2"',
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    };

    await syncProjectMarkdown("demo", "en", fetcher);

    const writes = requests.filter(({ init }) => init?.method === "PUT");
    expect(markdownReads).toBe(2);
    expect(writes).toHaveLength(2);
    expect(new Headers(writes[1].init?.headers).get("If-Match")).toBe('"md-v2"');
    expect(writes[1].init?.body).toBe(notesMarkdown(doc, "en"));
    expect(writes.every(({ url }) => url.endsWith("review-notes.md"))).toBe(true);
  });
});
