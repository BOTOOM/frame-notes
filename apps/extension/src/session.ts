import { storage } from "wxt/utils/storage";
import {
  mergeNotes,
  needsMarkdownSync,
  readProjectNotes,
  syncProjectMarkdown,
  syncProjectNotes,
} from "./file-sync";
import { emptyNotesDoc, type Locale, type NotesDoc, sortNotes } from "./model";

export type SyncStatus = "loading" | "syncing" | "synced" | "saved" | "local" | "error";

export interface LoopingRange {
  id: string;
  start: number;
  end: number;
}

export interface PlayerState {
  currentTime: number;
  duration: number;
  paused: boolean;
  fps: number;
  loopingRange: LoopingRange | null;
}

export interface SessionState extends PlayerState {
  doc: NotesDoc;
  syncStatus: SyncStatus;
}

export type PlayerCommand = "seek" | "pause" | "loop" | "stopLoop";
export type PlayerCommandValue = number | LoopingRange;

export interface NoteSessionOptions {
  projectFiles?: boolean;
  storage?: Pick<typeof storage, "getItem" | "setItem">;
}

const emptyPlayerState: PlayerState = {
  currentTime: 0,
  duration: 0,
  paused: true,
  fps: 30,
  loopingRange: null,
};

export class NoteSession {
  readonly project: string;
  readonly storageKey: `local:${string}`;
  private readonly commandPlayer: (command: PlayerCommand, value?: PlayerCommandValue) => void;
  private readonly projectFiles: boolean;
  private readonly storage: Pick<typeof storage, "getItem" | "setItem">;
  private locale: Locale;
  private readonly listeners = new Set<() => void>();
  private readonly documentListeners = new Set<() => void>();
  private readonly syncStatusListeners = new Set<() => void>();
  private readonly durationListeners = new Set<() => void>();
  private readonly currentTimeListeners = new Set<() => void>();
  private readonly loopingRangeListeners = new Set<() => void>();
  private readonly versions = new Map<string, string | null>();
  private readonly deletedIds = new Set<string>();
  private state: SessionState;
  private pendingProjectWrites = 0;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private writeQueue: Promise<void> = Promise.resolve();
  private disposed = false;
  private loaded = false;
  private pendingWrite = false;
  private hasLocalChanges = false;
  private hasPlayerState = false;

  constructor(
    project: string,
    origin: string,
    commandPlayer: (command: PlayerCommand, value?: PlayerCommandValue) => void,
    locale: Locale = "en",
    options: NoteSessionOptions = {},
  ) {
    this.project = project;
    this.storageKey = `local:frame-notes:${encodeURIComponent(origin)}:${encodeURIComponent(project)}`;
    this.commandPlayer = commandPlayer;
    this.projectFiles = options.projectFiles ?? true;
    this.storage = options.storage ?? storage;
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

  getCurrentTimeSnapshot = (): number => this.state.currentTime;

  subscribeCurrentTime = (listener: () => void): (() => void) => {
    this.currentTimeListeners.add(listener);
    return () => {
      this.currentTimeListeners.delete(listener);
    };
  };

  getLoopingRangeSnapshot = (): LoopingRange | null => this.state.loopingRange;

  subscribeLoopingRange = (listener: () => void): (() => void) => {
    this.loopingRangeListeners.add(listener);
    return () => {
      this.loopingRangeListeners.delete(listener);
    };
  };

  async load(): Promise<void> {
    if (!this.projectFiles) {
      let local: NotesDoc | null = null;
      try {
        local = await this.storage.getItem<NotesDoc>(this.storageKey);
      } catch {
        this.loaded = true;
        this.publish({ syncStatus: "error" });
        return;
      }
      const selected = this.hasLocalChanges
        ? mergeNotes(this.state.doc, local, this.deletedIds)
        : local;
      if (selected && selected !== this.state.doc) this.publish({ doc: selected });
      this.loaded = true;
      if (this.pendingWrite) {
        this.pendingWrite = false;
        await this.queueWrite(this.state.doc);
      } else {
        this.publish({ syncStatus: "saved" });
      }
      return;
    }

    let local: NotesDoc | null = null;
    let remoteAvailable = false;
    let shouldWrite = false;
    try {
      local = await this.storage.getItem<NotesDoc>(this.storageKey);
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
      if (this.hasPlayerState && selected && selected.fps !== this.state.fps) {
        selected = { ...selected, fps: this.state.fps };
        shouldWrite = true;
      }
      if (selected && needsMarkdownSync(remote.markdown, selected, this.locale)) shouldWrite = true;
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
    if (!this.projectFiles && !this.loaded && player.fps !== this.state.doc.fps) {
      this.publish({ ...player });
      return;
    }
    this.hasPlayerState = true;
    const fpsChanged = player.fps !== this.state.doc.fps;
    if (!fpsChanged) {
      this.publish({ ...player });
      return;
    }
    const doc = { ...this.state.doc, fps: player.fps };
    this.publish({ ...player, doc, syncStatus: "syncing" });
    this.persistAndSchedule(doc);
  }

  setLocale(locale: Locale): Promise<void> {
    if (this.disposed || locale === this.locale) return this.writeQueue;
    this.locale = locale;
    if (this.debounceTimer !== null || this.pendingWrite || this.pendingProjectWrites > 0) {
      return this.writeQueue;
    }
    if (!this.projectFiles) {
      if (this.hasLocalChanges) {
        this.publish({ syncStatus: "syncing" });
        return this.queueWrite(this.state.doc);
      }
      this.publish({ syncStatus: "saved" });
      return this.writeQueue;
    }
    this.publish({ syncStatus: "syncing" });
    if (this.hasLocalChanges) return this.queueWrite(this.state.doc);
    return this.queueMarkdownSync(locale);
  }

  updateNotes(notes: NotesDoc["notes"]): void {
    const nextIds = new Set(notes.map((note) => note.id));
    for (const note of this.state.doc.notes) {
      if (!nextIds.has(note.id)) this.deletedIds.add(note.id);
    }
    for (const note of notes) this.deletedIds.delete(note.id);
    const doc: NotesDoc = {
      ...this.state.doc,
      updatedAt: new Date().toISOString(),
      notes: sortNotes(notes),
    };
    this.hasLocalChanges = true;
    this.publish({ doc, syncStatus: "syncing" });
    this.persistAndSchedule(doc);
  }

  command(command: PlayerCommand, value?: PlayerCommandValue): void {
    this.commandPlayer(command, value);
  }

  dispose(): void {
    this.disposed = true;
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
      void this.queueWrite(this.state.doc, true);
    }
    this.listeners.clear();
    this.documentListeners.clear();
    this.syncStatusListeners.clear();
    this.durationListeners.clear();
    this.currentTimeListeners.clear();
    this.loopingRangeListeners.clear();
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
    if (this.state.currentTime !== previous.currentTime) {
      for (const listener of this.currentTimeListeners) listener();
    }
    if (this.state.loopingRange !== previous.loopingRange) {
      for (const listener of this.loopingRangeListeners) listener();
    }
  }

  private async storeLocal(doc: NotesDoc): Promise<boolean> {
    try {
      await this.storage.setItem(this.storageKey, doc);
      return true;
    } catch {
      this.publish({ syncStatus: "local" });
      return false;
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

  private queueWrite(doc: NotesDoc, allowDisposed = false): Promise<void> {
    this.pendingProjectWrites += 1;
    this.writeQueue = this.writeQueue
      .then(async () => {
        if (this.disposed && !allowDisposed) return;
        try {
          if (!this.projectFiles) {
            if ((await this.storeLocal(doc)) && this.state.doc === doc) {
              this.hasLocalChanges = false;
              this.publish({ syncStatus: "saved" });
            }
            return;
          }
          const deletedIds = new Set(this.deletedIds);
          const synced = await syncProjectNotes(
            doc,
            this.versions,
            () => this.locale,
            fetch,
            deletedIds,
          );
          for (const id of deletedIds) this.deletedIds.delete(id);
          if (this.state.doc === doc) {
            if (synced !== doc) {
              this.publish({ doc: synced });
              await this.storeLocal(synced);
            }
            this.hasLocalChanges = false;
            this.publish({ syncStatus: "synced" });
          } else if (synced !== doc) {
            const merged = mergeNotes(this.state.doc, synced, this.deletedIds);
            if (merged && merged !== this.state.doc) {
              this.publish({ doc: merged });
              await this.storeLocal(merged);
              void this.queueWrite(merged);
            }
          }
        } catch {
          if (this.state.doc === doc) this.publish({ syncStatus: "error" });
        }
      })
      .finally(() => {
        this.pendingProjectWrites -= 1;
      });
    return this.writeQueue;
  }

  private queueMarkdownSync(locale: Locale): Promise<void> {
    if (!this.projectFiles) {
      if (!this.disposed) this.publish({ syncStatus: "saved" });
      return this.writeQueue;
    }
    this.writeQueue = this.writeQueue.then(async () => {
      if (this.disposed) return;
      try {
        await syncProjectMarkdown(this.project, locale);
        if (!this.disposed) this.publish({ syncStatus: "synced" });
      } catch {
        if (!this.disposed) this.publish({ syncStatus: "error" });
      }
    });
    return this.writeQueue;
  }
}
