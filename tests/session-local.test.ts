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

  it("keeps the stored frame rate when player state arrives before local loading finishes", async () => {
    const fileName = "screen.mp4";
    const storedNote = {
      id: "stored",
      start: 1,
      end: 2,
      text: "Keep this range",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const storedDoc = {
      ...emptyNotesDoc(fileName),
      fps: 25,
      notes: [storedNote],
    };
    let resolveStorageRead: (value: unknown) => void = () => undefined;
    mockedStorage.getItem.mockImplementation(
      () =>
        new Promise<unknown>((resolve) => {
          resolveStorageRead = resolve;
        }),
    );

    const session = new NoteSession(fileName, "local-video:100:1700000000000", () => undefined, "en", {
      projectFiles: false,
      storage: mockedStorage as unknown as NoteSessionOptions["storage"],
    });
    const load = session.load();
    session.setPlayerState({
      currentTime: 0,
      duration: 10,
      paused: true,
      fps: 30,
      loopingRange: null,
    });
    resolveStorageRead(storedDoc);
    await load;

    expect(session.getDocumentSnapshot()).toEqual(storedDoc);
    expect(session.getDocumentSnapshot().fps).toBe(25);
    expect(session.getDocumentSnapshot().notes).toEqual([storedNote]);
    session.dispose();
  });

  it("merges notes added before local storage loading finishes", async () => {
    vi.useFakeTimers();
    const fileName = "screen.mp4";
    const storedNotes = [
      {
        id: "stored-1",
        start: 1,
        end: 2,
        text: "Keep this range",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "stored-2",
        start: 4,
        end: 5,
        text: "Keep this too",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    const storedDoc = {
      ...emptyNotesDoc(fileName),
      notes: storedNotes,
    };
    let resolveStorageRead: (value: unknown) => void = () => undefined;
    mockedStorage.getItem.mockImplementation(
      () =>
        new Promise<unknown>((resolve) => {
          resolveStorageRead = resolve;
        }),
    );

    const session = new NoteSession(fileName, "local-video:100:1700000000000", () => undefined, "en", {
      projectFiles: false,
      storage: mockedStorage as unknown as NoteSessionOptions["storage"],
    });
    const load = session.load();
    const addedNote = {
      id: "new",
      start: 8,
      end: 9,
      text: "Add this range",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    session.updateNotes([addedNote]);
    resolveStorageRead(storedDoc);
    await load;

    expect(session.getDocumentSnapshot().notes.map(({ id }) => id)).toEqual([
      "stored-1",
      "stored-2",
      "new",
    ]);
    await vi.advanceTimersByTimeAsync(800);
    await session.setLocale("en");
    const savedDoc = mockedStorage.setItem.mock.calls.at(-1)?.[1] as
      | ReturnType<typeof emptyNotesDoc>
      | undefined;
    expect(savedDoc?.notes).toHaveLength(3);
    expect(savedDoc?.notes.map(({ id }) => id)).toEqual(["stored-1", "stored-2", "new"]);
    session.dispose();
  });
});
