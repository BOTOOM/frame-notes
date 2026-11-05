import { describe, expect, it, vi } from "vitest";
import { mergeNotes, putFile } from "../apps/extension/src/file-sync";
import { emptyNotesDoc } from "../apps/extension/src/model";

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
});
