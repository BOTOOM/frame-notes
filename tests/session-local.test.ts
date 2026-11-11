import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyNotesDoc } from "../apps/extension/src/model";
import { NoteSession, type NoteSessionOptions } from "../apps/extension/src/session";

const mockedStorage = vi.hoisted(() => ({
  getItem: vi.fn(async () => null as unknown),
  setItem: vi.fn(async () => undefined),
}));

beforeEach(() => {
  mockedStorage.getItem.mockResolvedValue(null);
  mockedStorage.setItem.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("NoteSession local video mode", () => {
  it("loads and saves only through storage without project-file requests", async () => {
    const fileName = "screen.capture.mp4";
    const origin = "local-video:1234:1700000000000";
    const storageKey = `local:frame-notes:${encodeURIComponent(origin)}:${encodeURIComponent(fileName)}`;
    const storedDoc = emptyNotesDoc(fileName);
    const note = {
      id: "range",
      start: 1.25,
      end: 2.5,
      text: "Trim this section",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    mockedStorage.getItem.mockResolvedValue(storedDoc);
    const fetcher = vi.fn(async () => {
      throw new Error("project files must not be fetched");
    });
    vi.stubGlobal("fetch", fetcher);
    vi.useFakeTimers();

    const session = new NoteSession(fileName, origin, () => undefined, "en", {
      projectFiles: false,
      storage: mockedStorage as unknown as NoteSessionOptions["storage"],
    });
    await session.load();

    expect(session.storageKey).toBe(storageKey);
    expect(mockedStorage.getItem).toHaveBeenCalledWith(storageKey);
    expect(session.getDocumentSnapshot()).toEqual(storedDoc);
    expect(session.getSyncStatusSnapshot()).toBe("saved");

    session.updateNotes([note]);
    await vi.advanceTimersByTimeAsync(800);
    await session.setLocale("es");

    expect(mockedStorage.setItem).toHaveBeenCalledWith(
      storageKey,
      expect.objectContaining({ project: fileName, notes: [note] }),
    );
    expect(fetcher).not.toHaveBeenCalled();
    expect(session.getSyncStatusSnapshot()).toBe("saved");
    session.dispose();
  });
});
