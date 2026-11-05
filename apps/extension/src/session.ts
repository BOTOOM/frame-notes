import { storage } from "wxt/utils/storage";
import { mergeNotes, readProjectNotes, syncProjectNotes } from "./file-sync";
import { emptyNotesDoc, type Locale, type NotesDoc, sortNotes } from "./model";

export type SyncStatus = "loading" | "syncing" | "synced" | "local";

export interface PlayerState {
  currentTime: number;
  duration: number;
  paused: boolean;
  fps: number;
}

export interface SessionState extends PlayerState {
  doc: NotesDoc;
  syncStatus: SyncStatus;
}

export type PlayerCommand = "seek" | "pause";

const emptyPlayerState: PlayerState = {
  currentTime: 0,
  duration: 0,
  paused: true,
  fps: 30,
};

export class NoteSession {
  readonly project: string;
  readonly storageKey: `local:${string}`;
  private readonly commandPlayer: (command: PlayerCommand, time?: number) => void;
  private readonly locale: Locale;
  private readonly listeners = new Set<() => void>();
  private readonly documentListeners = new Set<() => void>();
  private readonly syncStatusListeners = new Set<() => void>();
  private readonly durationListeners = new Set<() => void>();
  private readonly versions = new Map<string, string | null>();
  private state: SessionState;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private writeQueue: Promise<void> = Promise.resolve();
  private disposed = false;
  private loaded = false;
  private pendingWrite = false;
  private hasLocalChanges = false;

  constructor(
    project: string,
    origin: string,
    commandPlayer: (command: PlayerCommand, time?: number) => void,
    locale: Locale = "en",
  ) {
    this.project = project;
    this.storageKey = `local:frame-notes:${encodeURIComponent(origin)}:${encodeURIComponent(project)}`;
    this.commandPlayer = commandPlayer;
    this.locale = locale;
    this.state = {
      ...emptyPlayerState,
      doc: emptyNotesDoc(project),
      syncStatus: "loading",
    };
  }

  getSnapshot = (): SessionState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getDocumentSnapshot = (): NotesDoc => this.state.doc;

  subscribeDocument = (listener: () => void): (() => void) => {
    this.documentListeners.add(listener);
    return () => {
      this.documentListeners.delete(listener);
    };
  };

  getSyncStatusSnapshot = (): SyncStatus => this.state.syncStatus;

  subscribeSyncStatus = (listener: () => void): (() => void) => {
    this.syncStatusListeners.add(listener);
    return () => {
      this.syncStatusListeners.delete(listener);
    };
  };

  getDurationSnapshot = (): number => this.state.duration;

  subscribeDuration = (listener: () => void): (() => void) => {
    this.durationListeners.add(listener);
    return () => {
      this.durationListeners.delete(listener);
    };
  };

  async load(): Promise<void> {
    let local: NotesDoc | null = null;
    let remoteAvailable = false;
    let shouldWrite = false;
    try {
      local = await storage.getItem<NotesDoc>(this.storageKey);
    } catch {
      this.publish({ syncStatus: "local" });
    }
    if (!this.hasLocalChanges && local) this.publish({ doc: local });

    try {
      const remote = await readProjectNotes(this.project);
      remoteAvailable = true;
      for (const [path, version] of remote.versions) this.versions.set(path, version);
      const candidate = this.hasLocalChanges ? this.state.doc : local;
      let selected = this.hasLocalChanges ? candidate : mergeNotes(candidate, remote.doc);
      if (selected && selected.fps !== this.state.fps) {
        selected = {
          ...selected,
          fps: this.state.fps,
          updatedAt: new Date().toISOString(),
        };
        shouldWrite = true;
      }
      if (selected) {
        if (selected !== this.state.doc) this.publish({ doc: selected });
        await this.storeLocal(selected);
      }

      if (remote.doc && selected === remote.doc && !shouldWrite && !this.pendingWrite) {
        this.publish({ syncStatus: "synced" });
      } else if (selected && (local || this.hasLocalChanges)) {
        shouldWrite = true;
      } else {
        this.publish({ syncStatus: "synced" });
      }
    } catch {
      this.publish({ syncStatus: "local" });
    } finally {
      this.loaded = true;
      if (this.pendingWrite) {
        shouldWrite = remoteAvailable;
        this.pendingWrite = false;
      }
      if (shouldWrite && remoteAvailable) {
        this.publish({ syncStatus: "syncing" });
        await this.queueWrite(this.state.doc);
      }
    }
  }

  setPlayerState(player: PlayerState): void {
    const fpsChanged = player.fps !== this.state.doc.fps;
    if (!fpsChanged) {
      this.publish({ ...player });
      return;
    }
    const doc = { ...this.state.doc, fps: player.fps, updatedAt: new Date().toISOString() };
    this.publish({ ...player, doc });
    this.persistAndSchedule(doc);
  }

  updateNotes(notes: NotesDoc["notes"]): void {
    const doc: NotesDoc = {
      ...this.state.doc,
      updatedAt: new Date().toISOString(),
      notes: sortNotes(notes),
    };
    this.hasLocalChanges = true;
    this.publish({ doc, syncStatus: "syncing" });
    this.persistAndSchedule(doc);
  }

  command(command: PlayerCommand, time?: number): void {
    this.commandPlayer(command, time);
  }

  dispose(): void {
    this.disposed = true;
    if (this.debounceTimer !== null) clearTimeout(this.debounceTimer);
    this.debounceTimer = null;
    this.listeners.clear();
    this.documentListeners.clear();
    this.syncStatusListeners.clear();
    this.durationListeners.clear();
  }

  private publish(update: Partial<SessionState>): void {
    if (this.disposed) return;
    const previous = this.state;
    this.state = { ...previous, ...update };
    for (const listener of this.listeners) listener();
    if (this.state.doc !== previous.doc) {
      for (const listener of this.documentListeners) listener();
    }
    if (this.state.syncStatus !== previous.syncStatus) {
      for (const listener of this.syncStatusListeners) listener();
    }
    if (this.state.duration !== previous.duration) {
      for (const listener of this.durationListeners) listener();
    }
  }

  private async storeLocal(doc: NotesDoc): Promise<void> {
    try {
      await storage.setItem(this.storageKey, doc);
    } catch {
      this.publish({ syncStatus: "local" });
    }
  }

  private persistAndSchedule(doc: NotesDoc): void {
    void this.storeLocal(doc);
    if (!this.loaded) {
      this.pendingWrite = true;
      return;
    }
    if (this.debounceTimer !== null) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      void this.queueWrite(doc);
    }, 800);
  }

  private queueWrite(doc: NotesDoc): Promise<void> {
    this.writeQueue = this.writeQueue.then(async () => {
      if (this.disposed) return;
      try {
        await syncProjectNotes(doc, this.versions, this.locale);
        if (this.state.doc.updatedAt === doc.updatedAt) this.publish({ syncStatus: "synced" });
      } catch {
        if (this.state.doc.updatedAt === doc.updatedAt) this.publish({ syncStatus: "local" });
      }
    });
    return this.writeQueue;
  }
}
