import type { PointerEvent, RefObject } from "react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { storage } from "wxt/utils/storage";
import { currentLocale, t } from "./i18n";
import { copyText, formatTime, type Note, normalizeNote, parseTime, sortNotes } from "./model";
import type { NoteSession } from "./session";

export type PanelAction = "new" | "start" | "end" | "copy" | "minimize" | "save" | "cancel";
export interface PanelActionRef {
  current: ((action: PanelAction) => void) | null;
}

interface NotePanelProps {
  session: NoteSession;
  project: string;
  actionRef: PanelActionRef;
  storageKey: `local:${string}`;
}

interface EditFields {
  id: string;
  createdAt: string;
  isNew: boolean;
  start: string;
  end: string;
  text: string;
}

interface PanelPreferences {
  left: number;
  top: number;
  minimized: boolean;
}

interface MarkerRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const panelWidth = 356;
const panelMargin = 12;

function clampPosition(left: number, top: number, width: number, height: number) {
  return {
    left: Math.max(panelMargin, Math.min(left, window.innerWidth - width - panelMargin)),
    top: Math.max(panelMargin, Math.min(top, window.innerHeight - height - panelMargin)),
  };
}

function makeFields(time: number): EditFields {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    createdAt: now,
    isNew: true,
    start: formatTime(time),
    end: "",
    text: "",
  };
}

async function copyToClipboard(text: string): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // Fall through to the selection-based copy path.
  }
  const input = document.createElement("textarea");
  input.value = text;
  input.setAttribute("aria-hidden", "true");
  input.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
  document.body.append(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("Clipboard unavailable");
}

export function NotePanel({ session, project, actionRef, storageKey }: NotePanelProps) {
  const doc = useSyncExternalStore(
    session.subscribeDocument,
    session.getDocumentSnapshot,
    session.getDocumentSnapshot,
  );
  const syncStatus = useSyncExternalStore(
    session.subscribeSyncStatus,
    session.getSyncStatusSnapshot,
    session.getSyncStatusSnapshot,
  );
  const locale = currentLocale();
  const [fields, setFields] = useState<EditFields | null>(null);
  const [invalidTime, setInvalidTime] = useState(false);
  const [position, setPosition] = useState(() => ({
    left: Math.max(panelMargin, window.innerWidth - panelWidth - 20),
    top: 64,
  }));
  const [minimized, setMinimized] = useState(false);
  const [deleted, setDeleted] = useState<Note | null>(null);
  const [toast, setToast] = useState("");
  const panelRef = useRef<HTMLElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const lastEditedId = useRef<string | null>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let active = true;
    void storage
      .getItem<PanelPreferences>(storageKey)
      .then((saved) => {
        if (!active || !saved) return;
        setPosition(
          clampPosition(
            saved.left,
            saved.top,
            saved.minimized ? 170 : panelWidth,
            panelRef.current?.offsetHeight ?? 500,
          ),
        );
        setMinimized(saved.minimized);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [storageKey]);

  useEffect(() => {
    const resize = () => {
      const bounds = panelRef.current?.getBoundingClientRect();
      setPosition((current) =>
        clampPosition(
          current.left,
          current.top,
          bounds?.width ?? panelWidth,
          bounds?.height ?? 500,
        ),
      );
    };
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    if (!deleted) return;
    const timer = window.setTimeout(() => {
      setDeleted(null);
      setToast("");
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [deleted]);

  useEffect(() => {
    if (!toast || deleted) return;
    const timer = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timer);
  }, [toast, deleted]);

  const persistPreferences = (nextPosition = position, nextMinimized = minimized) => {
    const saved: PanelPreferences = {
      ...nextPosition,
      minimized: nextMinimized,
    };
    void storage.setItem(storageKey, saved).catch(() => undefined);
  };

  const restoreFocus = () => {
    const target = previousFocus.current;
    previousFocus.current = null;
    if (target?.isConnected) target.focus();
  };

  const beginDraft = () => {
    if (fields) {
      setToast(t("finishEditing", locale));
      return;
    }
    previousFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setMinimized(false);
    persistPreferences(position, false);
    setInvalidTime(false);
    setFields(makeFields(session.getSnapshot().currentTime));
    session.command("pause");
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const beginEdit = (note: Note) => {
    previousFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    lastEditedId.current = note.id;
    setInvalidTime(false);
    setFields({
      id: note.id,
      createdAt: note.createdAt,
      isNew: false,
      start: formatTime(note.start),
      end: note.end === null ? "" : formatTime(note.end),
      text: note.text,
    });
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const saveFields = () => {
    if (!fields) return;
    const start = parseTime(fields.start, doc.fps);
    const end = fields.end.trim() ? parseTime(fields.end, doc.fps) : null;
    if (start === null || (fields.end.trim() && end === null)) {
      setInvalidTime(true);
      return;
    }
    const nextNote = normalizeNote({
      id: fields.id,
      start,
      end,
      text: fields.text,
      createdAt: fields.createdAt,
      updatedAt: new Date().toISOString(),
    });
    const notes = doc.notes.filter((note) => note.id !== nextNote.id);
    session.updateNotes(sortNotes([...notes, nextNote]));
    lastEditedId.current = nextNote.id;
    setFields(null);
    setInvalidTime(false);
    restoreFocus();
  };

  const cancelFields = () => {
    setFields(null);
    setInvalidTime(false);
    restoreFocus();
  };

  const setStartToNow = () => {
    if (fields) {
      setFields({ ...fields, start: formatTime(session.getSnapshot().currentTime) });
      setInvalidTime(false);
      return;
    }
    beginDraft();
  };

  const setEndToNow = () => {
    if (fields) {
      setFields({ ...fields, end: formatTime(session.getSnapshot().currentTime) });
      setInvalidTime(false);
      return;
    }
    const target =
      doc.notes.find((note) => note.id === lastEditedId.current) ??
      [...doc.notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    if (!target) return;
    lastEditedId.current = target.id;
    session.updateNotes(
      doc.notes.map((note) =>
        note.id === target.id
          ? {
              ...note,
              end: session.getSnapshot().currentTime,
              updatedAt: new Date().toISOString(),
            }
          : note,
      ),
    );
  };

  const toggleMinimized = () => {
    const next = !minimized;
    setMinimized(next);
    persistPreferences(position, next);
  };

  const copyAll = async () => {
    try {
      await copyToClipboard(copyText(doc, locale));
      setToast(t("copied", locale));
    } catch {
      setToast(t("copyFailed", locale));
    }
  };

  useEffect(() => {
    const handler = (action: PanelAction) => {
      if (action === "new") beginDraft();
      else if (action === "start") setStartToNow();
      else if (action === "end") setEndToNow();
      else if (action === "copy") void copyAll();
      else if (action === "minimize") toggleMinimized();
      else if (action === "save") saveFields();
      else if (action === "cancel") cancelFields();
    };
    actionRef.current = handler;
    return () => {
      actionRef.current = null;
    };
  });

  const handleStart = () => setStartToNow();
  const handleEnd = () => setEndToNow();
  const removeNote = (note: Note) => {
    setDeleted(note);
    setToast("");
    session.updateNotes(doc.notes.filter((item) => item.id !== note.id));
  };

  const undoDelete = () => {
    if (!deleted) return;
    session.updateNotes(sortNotes([...doc.notes, deleted]));
    setDeleted(null);
    setToast("");
  };

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.target instanceof Element && event.target.closest("button")) return;
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      left: position.left,
      top: position.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    if (!dragRef.current) return;
    const drag = dragRef.current;
    const size = panelRef.current?.getBoundingClientRect();
    setPosition(
      clampPosition(
        drag.left + event.clientX - drag.x,
        drag.top + event.clientY - drag.y,
        size?.width ?? panelWidth,
        size?.height ?? 500,
      ),
    );
  };

  const handlePointerUp = (event: PointerEvent<HTMLElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    persistPreferences(position);
  };

  const handlePointerCancel = () => {
    dragRef.current = null;
  };

  return (
    <div className="fn-layer">
      <Markers notes={doc.notes} session={session} seek={(time) => session.command("seek", time)} />
      <section
        className={`fn-panel${minimized ? " fn-panel--minimized" : ""}`}
        ref={panelRef}
        style={{ left: position.left, top: position.top }}
        aria-label={t("appName", locale)}
      >
        <header
          className="fn-header"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
        >
          <div className="fn-brand">
            <span className="fn-brand-mark" aria-hidden="true">
              F
            </span>
            <div>
              <strong>{t("appName", locale)}</strong>
              {!minimized && <span>{project}</span>}
            </div>
          </div>
          {minimized ? (
            <button
              type="button"
              className="fn-count-pill"
              onClick={toggleMinimized}
              title={t("expand", locale)}
              aria-label={t("expand", locale)}
            >
              {doc.notes.length} {t("notes", locale)}
            </button>
          ) : (
            <div className="fn-header-actions">
              <button
                type="button"
                className="fn-icon-button"
                onClick={toggleMinimized}
                title={t("minimize", locale)}
                aria-label={t("minimize", locale)}
              >
                −
              </button>
            </div>
          )}
        </header>
        {!minimized && (
          <>
            <div className="fn-toolbar">
              <div className="fn-total">
                <strong>{doc.notes.length}</strong> {t("notes", locale)}
                <span className={`fn-sync fn-sync--${syncStatus}`}>
                  <span aria-hidden="true" />
                  {syncStatus === "loading" || syncStatus === "syncing"
                    ? t("saving", locale)
                    : syncStatus === "local"
                      ? t("localOnly", locale)
                      : t("synced", locale)}
                </span>
              </div>
              <button type="button" className="fn-add" onClick={beginDraft}>
                {t("addNote", locale)}
              </button>
            </div>
            <main className="fn-notes">
              {fields?.isNew && (
                <NoteEditor
                  fields={fields}
                  setFields={setFields}
                  save={saveFields}
                  cancel={cancelFields}
                  startNow={handleStart}
                  endNow={handleEnd}
                  removeEnd={() => setFields({ ...fields, end: "" })}
                  invalidTime={invalidTime}
                  textareaRef={textareaRef}
                  fps={doc.fps}
                  locale={locale}
                />
              )}
              {!doc.notes.length && !fields && (
                <div className="fn-empty">
                  <span className="fn-empty-icon" aria-hidden="true">
                    ◷
                  </span>
                  <strong>{t("emptyTitle", locale)}</strong>
                  <p>{t("emptyBody", locale)}</p>
                </div>
              )}
              {sortNotes(doc.notes).map((note) =>
                fields?.id === note.id ? (
                  <NoteEditor
                    key={note.id}
                    fields={fields}
                    setFields={setFields}
                    save={saveFields}
                    cancel={cancelFields}
                    startNow={handleStart}
                    endNow={handleEnd}
                    removeEnd={() => setFields({ ...fields, end: "" })}
                    invalidTime={invalidTime}
                    textareaRef={textareaRef}
                    fps={doc.fps}
                    locale={locale}
                  />
                ) : (
                  <article className="fn-note" key={note.id}>
                    <div className="fn-note-top">
                      <button
                        type="button"
                        className="fn-time-chip"
                        onClick={() => session.command("seek", note.start)}
                        title={t("start", locale)}
                      >
                        {formatTime(note.start)}
                      </button>
                      {note.end !== null && (
                        <>
                          <span className="fn-range-arrow" aria-hidden="true">
                            →
                          </span>
                          <button
                            type="button"
                            className="fn-time-chip fn-time-chip--end"
                            onClick={() => session.command("seek", note.end ?? note.start)}
                            title={t("end", locale)}
                          >
                            {formatTime(note.end)}
                          </button>
                        </>
                      )}
                      <span className="fn-frame-chip">
                        f{Math.round(note.start * doc.fps)}
                        {note.end === null ? "" : `–f${Math.round(note.end * doc.fps)}`}
                      </span>
                      <div className="fn-note-actions">
                        <button
                          type="button"
                          className="fn-small-action"
                          onClick={() => beginEdit(note)}
                          aria-label={t("edit", locale)}
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          className="fn-small-action fn-danger"
                          onClick={() => removeNote(note)}
                          aria-label={t("delete", locale)}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                    <button type="button" className="fn-note-text" onClick={() => beginEdit(note)}>
                      {note.text || (
                        <span className="fn-muted">{t("notePlaceholder", locale)}</span>
                      )}
                    </button>
                  </article>
                ),
              )}
            </main>
            <footer className="fn-footer">
              <button type="button" className="fn-copy" onClick={() => void copyAll()}>
                <span aria-hidden="true">▣</span> {t("copyAll", locale)}
              </button>
              <p>{t("shortcuts", locale)}</p>
            </footer>
          </>
        )}
        {(deleted || toast) && (
          <div className="fn-toast" role="status">
            <span>{deleted ? t("deleted", locale) : toast}</span>
            {deleted && (
              <button type="button" onClick={undoDelete}>
                {t("undo", locale)}
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

interface NoteEditorProps {
  fields: EditFields;
  setFields: (fields: EditFields) => void;
  save: () => void;
  cancel: () => void;
  startNow: () => void;
  endNow: () => void;
  removeEnd: () => void;
  invalidTime: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  fps: number;
  locale: ReturnType<typeof currentLocale>;
}

function NoteEditor({
  fields,
  setFields,
  save,
  cancel,
  startNow,
  endNow,
  removeEnd,
  invalidTime,
  textareaRef,
  fps,
  locale,
}: NoteEditorProps) {
  return (
    <article className="fn-editor">
      <div className="fn-time-fields">
        <label>
          <span>{t("start", locale)}</span>
          <input
            value={fields.start}
            onChange={(event) => setFields({ ...fields, start: event.target.value })}
            onBlur={() => {
              const value = parseTime(fields.start, fps);
              if (value !== null) setFields({ ...fields, start: formatTime(value) });
            }}
            aria-label={t("start", locale)}
          />
          <button type="button" onClick={startNow} title={t("start", locale)}>
            {t("now", locale)}
          </button>
        </label>
        <label>
          <span>{t("end", locale)}</span>
          <input
            value={fields.end}
            placeholder="—"
            onChange={(event) => setFields({ ...fields, end: event.target.value })}
            onBlur={() => {
              const value = parseTime(fields.end, fps);
              if (value !== null) setFields({ ...fields, end: formatTime(value) });
            }}
            aria-label={t("end", locale)}
          />
          {fields.end ? (
            <button type="button" onClick={removeEnd} title={t("removeEnd", locale)}>
              ×
            </button>
          ) : (
            <button type="button" onClick={endNow} title={t("end", locale)}>
              {t("now", locale)}
            </button>
          )}
        </label>
      </div>
      <textarea
        ref={textareaRef}
        value={fields.text}
        onChange={(event) => setFields({ ...fields, text: event.target.value })}
        placeholder={t("notePlaceholder", locale)}
        rows={3}
      />
      {invalidTime && <p className="fn-validation">{t("invalidTime", locale)}</p>}
      <div className="fn-editor-actions">
        <button type="button" className="fn-secondary" onClick={cancel}>
          {t("cancel", locale)}
        </button>
        <button type="button" className="fn-primary" onClick={save}>
          {t("save", locale)}
        </button>
      </div>
    </article>
  );
}

interface MarkersProps {
  notes: Note[];
  session: NoteSession;
  seek: (time: number) => void;
}

function Markers({ notes, session, seek }: MarkersProps) {
  const duration = useSyncExternalStore(
    session.subscribeDuration,
    session.getDurationSnapshot,
    session.getDurationSnapshot,
  );
  const [bounds, setBounds] = useState<MarkerRect | null>(null);
  const [hoveredNoteId, setHoveredNoteId] = useState<string | null>(null);

  useEffect(() => {
    let input: HTMLInputElement | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let attributeObserver: MutationObserver | null = null;
    let mutationObserver: MutationObserver | null = null;
    let animation = 0;

    const measure = () => {
      if (animation) return;
      animation = requestAnimationFrame(() => {
        animation = 0;
        const next = document.querySelector<HTMLInputElement>('input[aria-label="Seek preview"]');
        if (next !== input) {
          resizeObserver?.disconnect();
          attributeObserver?.disconnect();
          input = next;
          if (input) {
            resizeObserver = new ResizeObserver(measure);
            resizeObserver.observe(input);
            attributeObserver = new MutationObserver(measure);
            attributeObserver.observe(input, {
              attributes: true,
              attributeFilter: ["aria-label", "class", "style"],
            });
          }
        }
        if (!input) {
          setBounds(null);
          return;
        }
        const rect = input.getBoundingClientRect();
        const style = getComputedStyle(input);
        if (
          rect.width <= 0 ||
          rect.height <= 0 ||
          style.display === "none" ||
          style.visibility === "hidden" ||
          style.opacity === "0"
        ) {
          setBounds(null);
          return;
        }
        setBounds({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
      });
    };

    mutationObserver = new MutationObserver(measure);
    const anchor = document.body ?? document.documentElement;
    mutationObserver.observe(anchor, { childList: true, subtree: true });
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    measure();
    return () => {
      mutationObserver?.disconnect();
      resizeObserver?.disconnect();
      attributeObserver?.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      if (animation) cancelAnimationFrame(animation);
    };
  }, []);

  if (!bounds || duration <= 0) return null;
  const inset = Math.min(8, bounds.width / 4);
  const trackWidth = Math.max(0, bounds.width - inset * 2);
  const xFor = (time: number) => inset + Math.min(1, Math.max(0, time / duration)) * trackWidth;
  const markerTop = bounds.top + Math.max(0, (bounds.height - 8) / 2);
  const flagWidth = Math.min(10, trackWidth);

  return (
    <section className="fn-markers" aria-label={t("markersLabel", currentLocale())}>
      {sortNotes(notes).map((note) => {
        const left = xFor(note.start);
        const flagLeft = Math.min(
          Math.max(bounds.left + left - flagWidth / 2, bounds.left + inset),
          bounds.left + inset + trackWidth - flagWidth,
        );
        const label = note.text || formatTime(note.start);
        const isHovered = hoveredNoteId === note.id;
        return (
          <div className="fn-marker-group" key={note.id}>
            {note.end === null ? (
              <div
                aria-hidden="true"
                className="fn-marker-point"
                data-hovered={isHovered ? "true" : undefined}
                style={{ left: bounds.left + left - 1, top: markerTop }}
              />
            ) : (
              <div
                aria-hidden="true"
                className="fn-marker-range"
                data-hovered={isHovered ? "true" : undefined}
                style={{
                  left: bounds.left + left,
                  top: markerTop,
                  width: Math.max(5, xFor(note.end) - left),
                }}
              />
            )}
            <button
              type="button"
              className="fn-marker-flag"
              style={{ left: flagLeft, top: bounds.top - 10, width: flagWidth }}
              title={label}
              aria-label={
                note.end === null
                  ? `${formatTime(note.start)}: ${label}`
                  : `${formatTime(note.start)}–${formatTime(note.end)}: ${label}`
              }
              onPointerEnter={() => setHoveredNoteId(note.id)}
              onPointerLeave={() => setHoveredNoteId(null)}
              onFocus={() => setHoveredNoteId(note.id)}
              onBlur={() => setHoveredNoteId(null)}
              onClick={() => seek(note.start)}
            />
          </div>
        );
      })}
    </section>
  );
}
