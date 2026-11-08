import type { Locale } from "./i18n";

export interface Note {
  id: string;
  start: number;
  end: number | null;
  text: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotesDoc {
  schemaVersion: 1;
  project: string;
  fps: number;
  updatedAt: string;
  notes: Note[];
}

export type { Locale } from "./i18n";

export function framesAt(time: number, fps: number): number {
  return Math.round(time * fps);
}

export function rangeDuration(note: Note, fps: number): { seconds: number; frames: number } | null {
  if (note.end === null) return null;
  return {
    seconds: Math.max(0, note.end - note.start),
    frames: Math.max(0, framesAt(note.end, fps) - framesAt(note.start, fps)),
  };
}

export function formatDuration(seconds: number): string {
  return `${Math.max(0, seconds).toFixed(3)} s`;
}

export function formatRangeDuration(note: Note, fps: number): string | null {
  const duration = rangeDuration(note, fps);
  return duration ? `${formatDuration(duration.seconds)} · ${duration.frames} f` : null;
}

export function parseFps(value: string | null | undefined): number {
  if (!value) return 30;
  const fraction = value.match(/^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
  const parsed = fraction ? Number(fraction[1]) / Number(fraction[2]) : Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
}

export function formatTime(time: number): string {
  const totalMilliseconds = Math.max(0, Math.round(time * 1000));
  const hours = Math.floor(totalMilliseconds / 3_600_000);
  const minutes = Math.floor((totalMilliseconds % 3_600_000) / 60_000);
  const seconds = Math.floor((totalMilliseconds % 60_000) / 1000);
  const milliseconds = totalMilliseconds % 1000;
  const clock = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
  return hours > 0 ? `${hours}:${clock}` : clock;
}

export function parseTime(input: string, fps: number): number | null {
  const value = input.trim();
  const frame = value.match(/^f(\d+)$/i);
  if (frame) return Number(frame[1]) / fps;

  const parts = value.split(":");
  if (parts.length < 1 || parts.length > 3) return null;
  if (parts.some((part) => !/^\d+(?:\.\d+)?$/.test(part))) return null;
  const numbers = parts.map(Number);
  if (numbers.some((part) => !Number.isFinite(part))) return null;
  if (parts.length === 1) return numbers[0] ?? null;

  const seconds = numbers[numbers.length - 1];
  const minutes = numbers[numbers.length - 2];
  if (seconds === undefined || minutes === undefined) return null;
  if (seconds >= 60 || (parts.length === 3 && minutes >= 60)) return null;
  const hours = parts.length === 3 ? (numbers[0] ?? 0) : 0;
  return hours * 3600 + minutes * 60 + seconds;
}

export function normalizeNote(note: Note): Note {
  if (note.end !== null && note.end < note.start) {
    return { ...note, start: note.end, end: note.start };
  }
  return note;
}

export function sortNotes(notes: Note[]): Note[] {
  return notes.map(normalizeNote).sort((a, b) => a.start - b.start);
}

export type SortOrder = "asc" | "desc";

export function orderNotes(notes: Note[], order: SortOrder): Note[] {
  return notes
    .map((note, index) => ({ note: normalizeNote(note), index }))
    .sort((a, b) => {
      const byStart = order === "asc" ? a.note.start - b.note.start : b.note.start - a.note.start;
      return byStart || a.index - b.index;
    })
    .map(({ note }) => note);
}

export function restoreDeletedNotes(notes: Note[], deleted: Note[]): Note[] {
  const restored = new Map(notes.map((note) => [note.id, note]));
  for (const note of deleted) {
    if (!restored.has(note.id)) restored.set(note.id, note);
  }
  return sortNotes([...restored.values()]);
}

function fpsLabel(fps: number): string {
  return Number.isInteger(fps) ? String(fps) : String(Number(fps.toFixed(3)));
}

export function copyText(doc: NotesDoc, locale: Locale): string {
  const title =
    locale === "es"
      ? `Notas de revisión — ${doc.project} (${doc.notes.length} notas, ${fpsLabel(doc.fps)} fps)`
      : `Review notes — ${doc.project} (${doc.notes.length} notes, ${fpsLabel(doc.fps)} fps)`;
  const entries = sortNotes(doc.notes).map((note, index) => {
    const start = framesAt(note.start, doc.fps);
    const end = note.end === null ? null : framesAt(note.end, doc.fps);
    const time =
      end === null
        ? `${formatTime(note.start)} (f${start})`
        : `${formatTime(note.start)} → ${formatTime(note.end ?? note.start)} (f${start}–f${end}, ${formatDuration(rangeDuration(note, doc.fps)?.seconds ?? 0)})`;
    const lines = note.text.split("\n");
    return `${index + 1}) ${time}: ${lines.join("\n   ")}`;
  });
  return [title, ...entries].join("\n");
}

export function notesMarkdown(doc: NotesDoc, locale: Locale): string {
  const intro =
    locale === "es"
      ? `# Notas de revisión — ${doc.project}\n\nProducido por Frame Notes. Los tiempos son tiempo de composición; los fotogramas usan ${fpsLabel(doc.fps)} fps.\n\nPara agentes: lee estas notas antes de editar y usa cada rango como objetivo de revisión.`
      : `# Review notes — ${doc.project}\n\nProduced by Frame Notes. Times are composition time; frames use ${fpsLabel(doc.fps)} fps.\n\nFor agents: read these notes before editing and use each range as a review target.`;
  return `${intro}\n\n${copyText(doc, locale)}\n`;
}

export function notesJson(doc: NotesDoc): string {
  return `${JSON.stringify({ ...doc, notes: sortNotes(doc.notes) }, null, 2)}\n`;
}

export function chooseNotesDoc(local: NotesDoc | null, remote: NotesDoc | null): NotesDoc | null {
  if (!remote) return local;
  if (!local) return remote;
  return Date.parse(remote.updatedAt) > Date.parse(local.updatedAt) ? remote : local;
}

export function emptyNotesDoc(project: string, fps = 30): NotesDoc {
  return {
    schemaVersion: 1,
    project,
    fps,
    updatedAt: new Date().toISOString(),
    notes: [],
  };
}
