import {
  ArrowDownNarrowWide,
  ArrowDownWideNarrow,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Crosshair,
  Languages,
  LocateFixed,
  Maximize2,
  Minus,
  Pencil,
  Plus,
  Repeat,
  Square,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import type { PointerEvent, RefObject } from "react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { storage } from "wxt/utils/storage";
import { DetailStrip } from "./detail-strip";
import { DictationControls } from "./dictation/controls";
import { insertAtCaret } from "./dictation/helpers";
import { useDictationEngineChoice } from "./dictation/preferences";
import type { SpeechBridge } from "./dictation/protocol";
import { useDictation } from "./dictation/use-dictation";
import {
  getLocalePreferenceSnapshot,
  LOCALE_PREFERENCES,
  type Locale,
  type LocalePreference,
  setLocalePreference,
  subscribeLocale,
  t,
} from "./i18n";
import {
  copyText,
  formatRangeDuration,
  formatTime,
  type Note,
  normalizeNote,
  orderNotes,
  parseTime,
  restoreDeletedNotes,
  type SortOrder,
  sortNotes,
} from "./model";
import { clampPanelHeight } from "./panel-layout";
import type { NoteSession } from "./session";
import { nudgeFrames } from "./timeline-math";
import { TimelineOverlay } from "./timeline-overlay";
import { useLocale } from "./use-locale";

export type PanelAction =
  | "new"
  | "start"
  | "end"
  | "copy"
  | "minimize"
  | "save"
  | "cancel"
  | "dictate"
  | "escape"
  | "locale-next"
  | "locale-previous"
  | "locale-first"
  | "locale-last"
  | "dialog-tab-next"
  | "dialog-tab-previous";
export interface PanelActionRef {
  current: ((action: PanelAction) => void) | null;
  languageMenuOpen?: boolean;
  deleteAllDialogOpen?: boolean;
}

interface NotePanelProps {
  session: NoteSession;
  project: string;
  actionRef: PanelActionRef;
  storageKey: `local:${string}`;
  speechBridge: SpeechBridge;
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
  sortOrder: SortOrder;
  height?: number;
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

export function NotePanel({
  session,
  project,
  actionRef,
  storageKey,
  speechBridge,
}: NotePanelProps) {
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
  const loopingRange = useSyncExternalStore(
    session.subscribeLoopingRange,
    session.getLoopingRangeSnapshot,
    session.getLoopingRangeSnapshot,
  );
  const locale = useLocale();
  const localePreference = useSyncExternalStore(
    subscribeLocale,
    getLocalePreferenceSnapshot,
    getLocalePreferenceSnapshot,
  );
  const engineChoice = useDictationEngineChoice();
  const [fields, setFields] = useState<EditFields | null>(null);
  const [invalidTime, setInvalidTime] = useState(false);
  const [position, setPosition] = useState(() => ({
    left: Math.max(panelMargin, window.innerWidth - panelWidth - 20),
    top: 64,
  }));
  const [minimized, setMinimized] = useState(false);
  const [panelHeight, setPanelHeight] = useState<number | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [localeMenuOpen, setLocaleMenuOpen] = useState(false);
  const [deleted, setDeleted] = useState<Note[] | null>(null);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [hoveredNoteId, setHoveredNoteId] = useState<string | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const localeMenuRef = useRef<HTMLDivElement | null>(null);
  const localeToggleRef = useRef<HTMLButtonElement | null>(null);
  const deleteAllButtonRef = useRef<HTMLButtonElement | null>(null);
  const addNoteButtonRef = useRef<HTMLButtonElement | null>(null);
  const deleteAllDialogRef = useRef<HTMLElement | null>(null);
  const deleteAllCancelRef = useRef<HTMLButtonElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fieldsRef = useRef<EditFields | null>(fields);
  const caretRef = useRef<number | null>(null);
  const selectionRef = useRef<{ start: number; end: number } | null>(null);
  const dragRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const resizeRef = useRef<{
    startY: number;
    startHeight: number;
    height: number;
  } | null>(null);
  const lastEditedId = useRef<string | null>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  fieldsRef.current = fields;
  actionRef.languageMenuOpen = localeMenuOpen;
  actionRef.deleteAllDialogOpen = deleteAllDialogOpen;
  const closeDeleteAllDialog = useCallback((restoreFocus = true) => {
    setDeleteAllDialogOpen(false);
    if (restoreFocus) deleteAllButtonRef.current?.focus();
  }, []);
  const focusDeleteAllAction = useCallback((action: "dialog-tab-next" | "dialog-tab-previous") => {
    const items = Array.from(
      deleteAllDialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ??
        [],
    );
    if (!items.length) return;
    const root = panelRef.current?.getRootNode();
    const activeElement = root instanceof ShadowRoot ? root.activeElement : document.activeElement;
    const current = items.indexOf(activeElement as HTMLButtonElement);
    const nextIndex =
      current < 0
        ? action === "dialog-tab-next"
          ? 0
          : items.length - 1
        : (current + (action === "dialog-tab-next" ? 1 : -1) + items.length) % items.length;
    items[nextIndex]?.focus();
  }, []);
  const dictation = useDictation({
    locale,
    engineChoice,
    bridge: speechBridge,
    pauseVideo: () => session.command("pause"),
    insertText: (text) => {
      const current = fieldsRef.current;
      if (!current) return;
      const input = textareaRef.current;
      const selection = selectionRef.current;
      const selectionStart =
        caretRef.current ?? selection?.start ?? input?.selectionStart ?? current.text.length;
      const selectionEnd =
        caretRef.current ?? selection?.end ?? input?.selectionEnd ?? current.text.length;
      const insertion = insertAtCaret(current.text, text, selectionStart, selectionEnd);
      fieldsRef.current = { ...current, text: insertion.value };
      caretRef.current = insertion.caret;
      selectionRef.current = null;
      setFields((previous) => (previous ? { ...previous, text: insertion.value } : previous));
      requestAnimationFrame(() => {
        if (!textareaRef.current) return;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(insertion.caret, insertion.caret);
      });
    },
  });

  useEffect(() => {
    let active = true;
    void storage
      .getItem<PanelPreferences>(storageKey)
      .then((saved) => {
        if (!active || !saved) return;
        const savedHeight =
          typeof saved.height === "number" && Number.isFinite(saved.height) && saved.height > 0
            ? clampPanelHeight(saved.height, saved.top, window.innerHeight, panelMargin)
            : null;
        setPanelHeight(savedHeight);
        setPosition(
          clampPosition(
            saved.left,
            saved.top,
            saved.minimized ? 170 : panelWidth,
            saved.minimized
              ? (panelRef.current?.offsetHeight ?? 500)
              : (savedHeight ?? panelRef.current?.offsetHeight ?? 500),
          ),
        );
        setMinimized(saved.minimized);
        setSortOrder(saved.sortOrder === "desc" ? "desc" : "asc");
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [storageKey]);

  useEffect(() => {
    if (!localeMenuOpen) return;
    const closeOnOutsidePointer = (event: globalThis.PointerEvent) => {
      const path = event.composedPath();
      if (
        path.includes(localeMenuRef.current as EventTarget) ||
        path.includes(localeToggleRef.current as EventTarget)
      )
        return;
      setLocaleMenuOpen(false);
    };
    window.addEventListener("pointerdown", closeOnOutsidePointer, true);
    return () => window.removeEventListener("pointerdown", closeOnOutsidePointer, true);
  }, [localeMenuOpen]);

  useEffect(() => {
    if (!localeMenuOpen) return;
    const selected =
      localeMenuRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]');
    selected?.focus();
  }, [localeMenuOpen]);

  useEffect(() => {
    if (deleteAllDialogOpen) deleteAllCancelRef.current?.focus();
  }, [deleteAllDialogOpen]);

  useEffect(() => {
    if (!deleteAllDialogOpen) return;
    const closeOnOutsidePointer = (event: globalThis.PointerEvent) => {
      if (!event.composedPath().includes(deleteAllDialogRef.current as EventTarget)) {
        closeDeleteAllDialog(false);
      }
    };
    window.addEventListener("pointerdown", closeOnOutsidePointer, true);
    return () => window.removeEventListener("pointerdown", closeOnOutsidePointer, true);
  }, [closeDeleteAllDialog, deleteAllDialogOpen]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const clampPanel = () => {
      const bounds = panel.getBoundingClientRect();
      setPosition((current) => {
        const next = clampPosition(current.left, current.top, bounds.width, bounds.height);
        return next.left === current.left && next.top === current.top ? current : next;
      });
    };
    const resizeObserver = new ResizeObserver(clampPanel);
    resizeObserver.observe(panel);
    window.addEventListener("resize", clampPanel);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", clampPanel);
    };
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

  const persistPreferences = (
    nextPosition = position,
    nextMinimized = minimized,
    nextSortOrder = sortOrder,
    nextHeight: number | null = panelHeight,
  ) => {
    const saved: PanelPreferences = {
      ...nextPosition,
      minimized: nextMinimized,
      sortOrder: nextSortOrder,
    };
    if (nextHeight !== null) saved.height = nextHeight;
    void storage.setItem(storageKey, saved).catch(() => undefined);
  };

  const restoreFocus = () => {
    const target = previousFocus.current;
    previousFocus.current = null;
    if (target?.isConnected) target.focus();
  };

  const beginDraft = (shouldPause = true) => {
    if (fields) {
      setToast(t("finishEditing", locale));
      return;
    }
    previousFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setMinimized(false);
    persistPreferences(position, false);
    setInvalidTime(false);
    caretRef.current = null;
    selectionRef.current = null;
    const draft = makeFields(session.getSnapshot().currentTime);
    fieldsRef.current = draft;
    setFields(draft);
    if (shouldPause) session.command("pause");
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const beginEdit = (note: Note) => {
    if (fields) {
      if (fields.id !== note.id) setToast(t("finishEditing", locale));
      return;
    }
    previousFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    lastEditedId.current = note.id;
    setInvalidTime(false);
    caretRef.current = null;
    selectionRef.current = null;
    const editFields = {
      id: note.id,
      createdAt: note.createdAt,
      isNew: false,
      start: formatTime(note.start),
      end: note.end === null ? "" : formatTime(note.end),
      text: note.text,
    };
    fieldsRef.current = editFields;
    setFields(editFields);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const saveFields = () => {
    if (!fields) return;
    dictation.cancel();
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
    fieldsRef.current = null;
    caretRef.current = null;
    selectionRef.current = null;
    setFields(null);
    setInvalidTime(false);
    restoreFocus();
  };

  const cancelFields = () => {
    dictation.cancel();
    fieldsRef.current = null;
    caretRef.current = null;
    selectionRef.current = null;
    setFields(null);
    setInvalidTime(false);
    restoreFocus();
  };

  const updateEditorText = (text: string, caret: number) => {
    const current = fieldsRef.current;
    if (!current) return;
    const next = { ...current, text };
    fieldsRef.current = next;
    caretRef.current = caret;
    selectionRef.current = null;
    setFields(next);
  };

  const updateEditorSelection = (start: number, end: number) => {
    selectionRef.current = { start, end };
    caretRef.current = null;
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

  const toggleSortOrder = () => {
    const next = sortOrder === "asc" ? "desc" : "asc";
    setSortOrder(next);
    persistPreferences(position, minimized, next);
  };

  const focusLocaleOption = (action: PanelAction) => {
    const items = Array.from(
      localeMenuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [],
    );
    if (!items.length) return;
    const root = panelRef.current?.getRootNode();
    const activeElement = root instanceof ShadowRoot ? root.activeElement : document.activeElement;
    const current = items.indexOf(activeElement as HTMLButtonElement);
    const nextIndex =
      action === "locale-first"
        ? 0
        : action === "locale-last"
          ? items.length - 1
          : (current + (action === "locale-next" ? 1 : -1) + items.length) % items.length;
    items[nextIndex]?.focus();
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
      else if (action === "dictate") {
        if (!fields) beginDraft(false);
        dictation.start();
      } else if (action === "escape") {
        if (deleteAllDialogOpen) {
          closeDeleteAllDialog();
        } else if (localeMenuOpen) {
          setLocaleMenuOpen(false);
          localeToggleRef.current?.focus();
        } else {
          cancelFields();
        }
      } else if (action.startsWith("locale-") && localeMenuOpen) {
        focusLocaleOption(action);
      } else if (action === "dialog-tab-next" || action === "dialog-tab-previous") {
        focusDeleteAllAction(action);
      }
    };
    actionRef.current = handler;
    return () => {
      actionRef.current = null;
    };
  });

  const handleStart = () => setStartToNow();
  const handleEnd = () => setEndToNow();
  const removeNote = (note: Note) => {
    if (loopingRange?.id === note.id) session.command("stopLoop");
    setDeleted([note]);
    setToast("");
    session.updateNotes(doc.notes.filter((item) => item.id !== note.id));
  };

  const deleteAllNotes = () => {
    if (!doc.notes.length || fields) {
      closeDeleteAllDialog();
      return;
    }
    const removed = [...doc.notes];
    if (loopingRange && removed.some((note) => note.id === loopingRange.id)) {
      session.command("stopLoop");
    }
    setDeleted(removed);
    setToast("");
    closeDeleteAllDialog(false);
    session.updateNotes([]);
    requestAnimationFrame(() => addNoteButtonRef.current?.focus());
  };

  const undoDelete = () => {
    if (!deleted) return;
    session.updateNotes(restoreDeletedNotes(doc.notes, deleted));
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

  const updatePanelHeight = (clientY: number): number | null => {
    const resize = resizeRef.current;
    if (!resize) return null;
    const height = clampPanelHeight(
      resize.startHeight + clientY - resize.startY,
      position.top,
      window.innerHeight,
      panelMargin,
    );
    resize.height = height;
    setPanelHeight(height);
    return height;
  };

  const handleResizePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    event.preventDefault();
    const bounds = panelRef.current?.getBoundingClientRect();
    if (!bounds) return;
    resizeRef.current = {
      startY: event.clientY,
      startHeight: bounds.height,
      height: bounds.height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsResizing(true);
  };

  const handleResizePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!resizeRef.current) return;
    event.stopPropagation();
    event.preventDefault();
    updatePanelHeight(event.clientY);
  };

  const handleResizePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const resize = resizeRef.current;
    if (!resize) return;
    event.stopPropagation();
    event.preventDefault();
    const height = updatePanelHeight(event.clientY) ?? resize.height;
    resizeRef.current = null;
    setIsResizing(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    persistPreferences(position, minimized, sortOrder, height);
  };

  const handleResizePointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    const resize = resizeRef.current;
    if (!resize) return;
    event.stopPropagation();
    event.preventDefault();
    resizeRef.current = null;
    setPanelHeight(resize.height);
    setIsResizing(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    persistPreferences(position, minimized, sortOrder, resize.height);
  };

  const draftStart = fields ? parseTime(fields.start, doc.fps) : null;
  const draftEnd = fields?.end.trim() ? parseTime(fields.end, doc.fps) : null;
  const syncLabel =
    syncStatus === "loading" || syncStatus === "syncing"
      ? t("saving", locale)
      : syncStatus === "local"
        ? t("localOnly", locale)
        : syncStatus === "error"
          ? t("syncError", locale)
          : t("synced", locale);
  const syncTitle = syncStatus === "synced" ? t("syncedTitle", locale) : syncLabel;

  return (
    <div className="fn-layer">
      <Markers notes={doc.notes} session={session} seek={(time) => session.command("seek", time)} />
      <TimelineOverlay
        notes={doc.notes}
        activeNoteId={fields?.id ?? null}
        hoveredNoteId={hoveredNoteId}
      />
      <section
        className={`fn-panel${minimized ? " fn-panel--minimized" : ""}`}
        ref={panelRef}
        style={{
          left: position.left,
          top: position.top,
          ...(panelHeight !== null && !minimized ? { height: panelHeight } : {}),
        }}
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
              <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
                <title>Frame Notes logo</title>
                <path
                  d="M6 48h52"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
                <path
                  d="M12 40v16M24 44v8M36 44v8M48 44v8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  opacity=".5"
                />
                <path d="M30 48V8h22l-6 8 6 8H30" fill="var(--fn-accent)" />
                <path
                  d="M30 48V8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </svg>
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
              <Maximize2 size={16} strokeWidth={2} aria-hidden="true" focusable="false" />
              {doc.notes.length} {t("notes", locale)}
            </button>
          ) : (
            <div className="fn-header-actions">
              <div className="fn-language-control">
                <button
                  ref={localeToggleRef}
                  type="button"
                  className="fn-icon-button"
                  aria-label={t("language", locale)}
                  title={t("language", locale)}
                  aria-haspopup="menu"
                  aria-expanded={localeMenuOpen}
                  onClick={() => setLocaleMenuOpen((open) => !open)}
                >
                  <Languages size={16} strokeWidth={2} aria-hidden="true" focusable="false" />
                </button>
                {localeMenuOpen && (
                  <div className="fn-language-menu" role="menu" ref={localeMenuRef}>
                    {LOCALE_PREFERENCES.map((choice: LocalePreference) => {
                      const label =
                        choice === "auto"
                          ? t("languageAuto", locale)
                          : choice === "es"
                            ? t("languageSpanish", locale)
                            : t("languageEnglish", locale);
                      const selected = choice === localePreference;
                      return (
                        <button
                          type="button"
                          role="menuitemradio"
                          aria-checked={selected}
                          tabIndex={selected ? 0 : -1}
                          key={choice}
                          onClick={() => {
                            setLocalePreference(choice);
                            setLocaleMenuOpen(false);
                            localeToggleRef.current?.focus();
                          }}
                        >
                          <span>{label}</span>
                          {selected && (
                            <Check size={14} strokeWidth={2} aria-hidden="true" focusable="false" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <button
                type="button"
                className="fn-icon-button"
                onClick={toggleMinimized}
                title={t("minimize", locale)}
                aria-label={t("minimize", locale)}
              >
                <Minus size={16} strokeWidth={2} aria-hidden="true" focusable="false" />
              </button>
            </div>
          )}
        </header>
        {!minimized && (
          <>
            <div className="fn-toolbar">
              <div className="fn-total">
                <strong>{doc.notes.length}</strong> {t("notes", locale)}
                <span className={`fn-sync fn-sync--${syncStatus}`} title={syncTitle}>
                  <span className="fn-sync-dot" aria-hidden="true" />
                  <span className="fn-sync-label">{syncLabel}</span>
                </span>
              </div>
              <div className="fn-toolbar-actions">
                <button
                  type="button"
                  ref={deleteAllButtonRef}
                  className="fn-icon-button fn-delete-all"
                  onClick={() => {
                    setLocaleMenuOpen(false);
                    setDeleteAllDialogOpen(true);
                  }}
                  aria-label={t("deleteAll", locale)}
                  title={t("deleteAll", locale)}
                  disabled={doc.notes.length === 0 || fields !== null}
                >
                  <Trash2 size={14} strokeWidth={2} aria-hidden="true" focusable="false" />
                </button>
                <button
                  type="button"
                  className="fn-icon-button"
                  onClick={toggleSortOrder}
                  aria-label={t(sortOrder === "asc" ? "oldestFirst" : "newestFirst", locale)}
                  title={t(sortOrder === "asc" ? "oldestFirst" : "newestFirst", locale)}
                >
                  {sortOrder === "asc" ? (
                    <ArrowDownNarrowWide
                      size={14}
                      strokeWidth={2}
                      aria-hidden="true"
                      focusable="false"
                    />
                  ) : (
                    <ArrowDownWideNarrow
                      size={14}
                      strokeWidth={2}
                      aria-hidden="true"
                      focusable="false"
                    />
                  )}
                </button>
                <button
                  ref={addNoteButtonRef}
                  type="button"
                  className="fn-add"
                  onClick={() => beginDraft()}
                >
                  <Plus size={14} strokeWidth={2} aria-hidden="true" focusable="false" />
                  {t("addNote", locale)}
                </button>
              </div>
            </div>
            <DetailStrip
              session={session}
              notes={doc.notes}
              fps={doc.fps}
              editorStart={draftStart}
              editorEnd={draftEnd}
            />
            <main className="fn-notes">
              {fields?.isNew && (
                <NoteEditor
                  fields={fields}
                  setFields={setFields}
                  save={saveFields}
                  cancel={cancelFields}
                  startNow={handleStart}
                  endNow={handleEnd}
                  session={session}
                  removeEnd={() => setFields({ ...fields, end: "" })}
                  invalidTime={invalidTime}
                  clearValidation={() => setInvalidTime(false)}
                  textareaRef={textareaRef}
                  fps={doc.fps}
                  locale={locale}
                  dictation={dictation}
                  updateText={updateEditorText}
                  updateSelection={updateEditorSelection}
                />
              )}
              {!doc.notes.length && !fields && (
                <div className="fn-empty">
                  <span className="fn-empty-icon" aria-hidden="true">
                    <Clock size={14} strokeWidth={2} aria-hidden="true" focusable="false" />
                  </span>
                  <strong>{t("emptyTitle", locale)}</strong>
                  <p>{t("emptyBody", locale)}</p>
                </div>
              )}
              {orderNotes(doc.notes, sortOrder).map((note) =>
                fields?.id === note.id ? (
                  <NoteEditor
                    key={note.id}
                    fields={fields}
                    setFields={setFields}
                    save={saveFields}
                    cancel={cancelFields}
                    startNow={handleStart}
                    endNow={handleEnd}
                    session={session}
                    removeEnd={() => setFields({ ...fields, end: "" })}
                    invalidTime={invalidTime}
                    clearValidation={() => setInvalidTime(false)}
                    textareaRef={textareaRef}
                    fps={doc.fps}
                    locale={locale}
                    dictation={dictation}
                    updateText={updateEditorText}
                    updateSelection={updateEditorSelection}
                  />
                ) : (
                  <article
                    className="fn-note"
                    key={note.id}
                    onPointerEnter={() => setHoveredNoteId(note.id)}
                    onPointerLeave={() => setHoveredNoteId(null)}
                  >
                    <div className="fn-note-top">
                      <button
                        type="button"
                        className="fn-time-chip"
                        onClick={() => session.command("seek", note.start)}
                        title={t("start", locale)}
                      >
                        <LocateFixed
                          size={14}
                          strokeWidth={2}
                          aria-hidden="true"
                          focusable="false"
                        />
                        {formatTime(note.start)}
                      </button>
                      {note.end !== null && (
                        <>
                          <span className="fn-range-arrow" aria-hidden="true">
                            <ArrowRight
                              size={14}
                              strokeWidth={2}
                              aria-hidden="true"
                              focusable="false"
                            />
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
                      <div className="fn-note-actions">
                        {note.end !== null && note.end > note.start && (
                          <button
                            type="button"
                            className={`fn-small-action fn-loop-action${loopingRange?.id === note.id ? " fn-loop-action--active" : ""}`}
                            onClick={() =>
                              loopingRange?.id === note.id
                                ? session.command("stopLoop")
                                : session.command("loop", {
                                    id: note.id,
                                    start: note.start,
                                    end: note.end ?? note.start,
                                  })
                            }
                            aria-label={t(
                              loopingRange?.id === note.id ? "stopLoop" : "loopRange",
                              locale,
                            )}
                            title={t(
                              loopingRange?.id === note.id ? "stopLoop" : "loopRange",
                              locale,
                            )}
                          >
                            {loopingRange?.id === note.id ? (
                              <Square
                                size={14}
                                strokeWidth={2}
                                aria-hidden="true"
                                focusable="false"
                              />
                            ) : (
                              <Repeat
                                size={14}
                                strokeWidth={2}
                                aria-hidden="true"
                                focusable="false"
                              />
                            )}
                          </button>
                        )}
                        <button
                          type="button"
                          className="fn-small-action"
                          onClick={() => beginEdit(note)}
                          aria-label={t("edit", locale)}
                          title={t("edit", locale)}
                        >
                          <Pencil size={14} strokeWidth={2} aria-hidden="true" focusable="false" />
                        </button>
                        <button
                          type="button"
                          className="fn-small-action fn-danger"
                          onClick={() => removeNote(note)}
                          aria-label={t("delete", locale)}
                          title={t("delete", locale)}
                        >
                          <Trash2 size={14} strokeWidth={2} aria-hidden="true" focusable="false" />
                        </button>
                      </div>
                    </div>
                    <span className="fn-note-meta">
                      {note.end === null
                        ? `f${Math.round(note.start * doc.fps)}`
                        : `${formatRangeDuration(note, doc.fps)} · f${Math.round(note.start * doc.fps)}–f${Math.round(note.end * doc.fps)}`}
                    </span>
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
                <Copy size={14} strokeWidth={2} aria-hidden="true" focusable="false" />
                {t("copyAll", locale)}
              </button>
              <p>{t("shortcuts", locale)}</p>
            </footer>
          </>
        )}
        {deleteAllDialogOpen && (
          <div
            className="fn-dialog-backdrop"
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) closeDeleteAllDialog();
            }}
          >
            <section
              className="fn-confirm-dialog"
              ref={deleteAllDialogRef}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="fn-delete-all-title"
              aria-describedby="fn-delete-all-description"
            >
              <strong id="fn-delete-all-title">{t("deleteAll", locale)}</strong>
              <p id="fn-delete-all-description">
                {t("deleteAllPrompt", locale).replace("{count}", String(doc.notes.length))}
              </p>
              <div>
                <button
                  type="button"
                  className="fn-secondary"
                  ref={deleteAllCancelRef}
                  onClick={() => closeDeleteAllDialog()}
                >
                  {t("cancel", locale)}
                </button>
                <button type="button" className="fn-danger-confirm" onClick={deleteAllNotes}>
                  {t("deleteAll", locale)}
                </button>
              </div>
            </section>
          </div>
        )}
        {(deleted || toast) && (
          <div className="fn-toast" role="status">
            <span>
              {deleted
                ? deleted.length === 1
                  ? t("deleted", locale)
                  : t("deletedMany", locale).replace("{count}", String(deleted.length))
                : toast}
            </span>
            {toast === t("copied", locale) && (
              <Check size={14} strokeWidth={2} aria-hidden="true" focusable="false" />
            )}
            {deleted && (
              <>
                <span aria-hidden="true">·</span>
                <button type="button" onClick={undoDelete}>
                  <Undo2 size={14} strokeWidth={2} aria-hidden="true" focusable="false" />
                  {t("undo", locale)}
                </button>
              </>
            )}
          </div>
        )}
        {!minimized && (
          // biome-ignore lint/a11y/useSemanticElements: This separator is an interactive resize handle.
          <div
            className={`fn-resize-handle${isResizing ? " fn-resize-handle--active" : ""}`}
            role="separator"
            aria-orientation="horizontal"
            aria-label={t("resizePanel", locale)}
            title={t("resizePanel", locale)}
            onPointerDown={handleResizePointerDown}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            onPointerCancel={handleResizePointerCancel}
            onDoubleClick={(event) => {
              event.stopPropagation();
              event.preventDefault();
              resizeRef.current = null;
              setIsResizing(false);
              setPanelHeight(null);
              persistPreferences(position, minimized, sortOrder, null);
            }}
          />
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
  session: NoteSession;
  removeEnd: () => void;
  invalidTime: boolean;
  clearValidation: () => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  fps: number;
  locale: Locale;
  dictation: ReturnType<typeof useDictation>;
  updateText: (text: string, caret: number) => void;
  updateSelection: (start: number, end: number) => void;
}

function NoteEditor({
  fields,
  setFields,
  save,
  cancel,
  startNow,
  endNow,
  session,
  removeEnd,
  invalidTime,
  clearValidation,
  textareaRef,
  fps,
  locale,
  dictation,
  updateText,
  updateSelection,
}: NoteEditorProps) {
  const nudge = (edge: "start" | "end", direction: -1 | 1, shiftKey: boolean) => {
    const state = session.getSnapshot();
    const current =
      parseTime(fields[edge], fps) ??
      (edge === "end" ? (parseTime(fields.start, fps) ?? state.currentTime) : state.currentTime);
    let next = nudgeFrames(current, direction * (shiftKey ? 10 : 1), fps, state.duration);
    const start = edge === "start" ? next : parseTime(fields.start, fps);
    const end = edge === "end" ? next : parseTime(fields.end, fps);
    if (edge === "start" && end !== null) next = Math.min(next, end);
    if (edge === "end" && start !== null) next = Math.max(next, start);
    setFields({ ...fields, [edge]: formatTime(next) });
    clearValidation();
    session.command("seek", next);
  };

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
          <div className="fn-time-controls">
            <div className="fn-time-nudges">
              <button
                type="button"
                title={t("shiftTenFrames", locale)}
                aria-label={t("nudgeBack", locale)}
                onClick={(event) => nudge("start", -1, event.shiftKey)}
              >
                <ChevronLeft size={14} strokeWidth={2} aria-hidden="true" focusable="false" />
                1f
              </button>
              <button
                type="button"
                title={t("shiftTenFrames", locale)}
                aria-label={t("nudgeForward", locale)}
                onClick={(event) => nudge("start", 1, event.shiftKey)}
              >
                <ChevronRight size={14} strokeWidth={2} aria-hidden="true" focusable="false" />
                1f
              </button>
            </div>
            <button type="button" onClick={startNow} title={t("start", locale)}>
              <Crosshair size={14} strokeWidth={2} aria-hidden="true" focusable="false" />
              {t("now", locale)}
            </button>
          </div>
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
          <div className="fn-time-controls">
            <div className="fn-time-nudges">
              <button
                type="button"
                title={t("shiftTenFrames", locale)}
                aria-label={t("nudgeBack", locale)}
                onClick={(event) => nudge("end", -1, event.shiftKey)}
              >
                <ChevronLeft size={14} strokeWidth={2} aria-hidden="true" focusable="false" />
                1f
              </button>
              <button
                type="button"
                title={t("shiftTenFrames", locale)}
                aria-label={t("nudgeForward", locale)}
                onClick={(event) => nudge("end", 1, event.shiftKey)}
              >
                <ChevronRight size={14} strokeWidth={2} aria-hidden="true" focusable="false" />
                1f
              </button>
            </div>
            {fields.end ? (
              <button
                type="button"
                onClick={removeEnd}
                title={t("removeEnd", locale)}
                aria-label={t("removeEnd", locale)}
              >
                <X size={14} strokeWidth={2} aria-hidden="true" focusable="false" />
              </button>
            ) : (
              <button type="button" onClick={endNow} title={t("end", locale)}>
                <Crosshair size={14} strokeWidth={2} aria-hidden="true" focusable="false" />
                {t("now", locale)}
              </button>
            )}
          </div>
        </label>
      </div>
      <textarea
        ref={textareaRef}
        value={fields.text}
        onChange={(event) => updateText(event.target.value, event.target.selectionStart)}
        onSelect={(event) => {
          const input = event.currentTarget;
          updateSelection(input.selectionStart, input.selectionEnd);
        }}
        placeholder={t("notePlaceholder", locale)}
        rows={3}
      />
      <DictationControls dictation={dictation} />
      {invalidTime && <p className="fn-validation">{t("invalidTime", locale)}</p>}
      <div className="fn-editor-actions">
        <button type="button" className="fn-secondary" onClick={cancel}>
          <X size={14} strokeWidth={2} aria-hidden="true" focusable="false" />
          {t("cancel", locale)}
        </button>
        <button type="button" className="fn-primary" onClick={save}>
          <Check size={14} strokeWidth={2} aria-hidden="true" focusable="false" />
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
  const locale = useLocale();
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
    <section className="fn-markers" aria-label={t("markersLabel", locale)}>
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
