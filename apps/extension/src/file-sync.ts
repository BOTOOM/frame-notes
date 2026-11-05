import {
  chooseNotesDoc,
  type Locale,
  type NotesDoc,
  notesJson,
  notesMarkdown,
  sortNotes,
} from "./model";

export type FileVersions = Map<string, string | null>;
export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface FilePayload {
  content: string;
  version?: string | null;
}

interface ConflictPayload {
  currentVersion: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function isFilePayload(value: unknown): value is FilePayload {
  return (
    isRecord(value) &&
    typeof value.content === "string" &&
    (typeof value.version === "string" || value.version === null || value.version === undefined)
  );
}

function isConflictPayload(value: unknown): value is ConflictPayload {
  return (
    isRecord(value) && (typeof value.currentVersion === "string" || value.currentVersion === null)
  );
}

function isNote(value: unknown): value is NotesDoc["notes"][number] {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.start === "number" &&
    Number.isFinite(value.start) &&
    (value.end === null || (typeof value.end === "number" && Number.isFinite(value.end))) &&
    typeof value.text === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
}

export interface RemoteNotes {
  doc: NotesDoc | null;
  markdown: string | null;
  versions: FileVersions;
}

class FileConflictError extends Error {
  constructor(path: string, status: number) {
    super(`Failed to save ${path} (${status})`);
  }
}

export function projectFileUrl(project: string, path: string): string {
  return `/api/projects/${encodeURIComponent(project)}/files/${encodeURIComponent(path)}`;
}

async function readFile(
  fetcher: FetchLike,
  project: string,
  path: string,
): Promise<{ content: string; version: string | null } | null> {
  const response = await fetcher(projectFileUrl(project, path));
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Failed to read ${path} (${response.status})`);
  const payload: unknown = await response.json();
  if (!isFilePayload(payload)) throw new Error(`Missing content for ${path}`);
  return { content: payload.content, version: payload.version ?? response.headers.get("etag") };
}

function isNotesDoc(value: unknown): value is NotesDoc {
  if (!isRecord(value)) return false;
  return (
    value.schemaVersion === 1 &&
    typeof value.project === "string" &&
    typeof value.fps === "number" &&
    Number.isFinite(value.fps) &&
    value.fps > 0 &&
    typeof value.updatedAt === "string" &&
    Array.isArray(value.notes) &&
    value.notes.every(isNote)
  );
}

export async function readProjectNotes(
  project: string,
  fetcher: FetchLike = fetch,
): Promise<RemoteNotes> {
  const [jsonFile, markdownFile] = await Promise.all([
    readFile(fetcher, project, "review-notes.json"),
    readFile(fetcher, project, "review-notes.md"),
  ]);
  const versions: FileVersions = new Map([
    ["review-notes.json", jsonFile?.version ?? null],
    ["review-notes.md", markdownFile?.version ?? null],
  ]);
  if (!jsonFile) return { doc: null, markdown: markdownFile?.content ?? null, versions };

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonFile.content);
  } catch {
    throw new Error("Invalid review-notes.json");
  }
  if (!isNotesDoc(parsed) || parsed.project !== project) {
    throw new Error("Invalid review-notes.json");
  }
  return { doc: parsed, markdown: markdownFile?.content ?? null, versions };
}

export async function putFile(
  fetcher: FetchLike,
  project: string,
  path: string,
  content: string,
  version: string | null,
  retryConflict = true,
): Promise<string> {
  const url = projectFileUrl(project, path);
  const headers = new Headers({ "Content-Type": "text/plain" });
  if (version) headers.set("If-Match", version);
  else headers.set("If-None-Match", "*");

  let response = await fetcher(url, { method: "PUT", headers, body: content });
  if (response.status === 409 || response.status === 428) {
    if (!retryConflict) throw new FileConflictError(path, response.status);
    const conflictValue: unknown = await response.json().catch(() => null);
    if (!isConflictPayload(conflictValue)) throw new Error(`Missing version while saving ${path}`);
    const currentVersion = conflictValue.currentVersion;
    const retryHeaders = new Headers({ "Content-Type": "text/plain" });
    if (currentVersion === null) retryHeaders.set("If-None-Match", "*");
    else retryHeaders.set("If-Match", currentVersion);
    response = await fetcher(url, {
      method: "PUT",
      headers: retryHeaders,
      body: content,
    });
  }
  if (!response.ok) {
    if (response.status === 409 || response.status === 428)
      throw new FileConflictError(path, response.status);
    throw new Error(`Failed to save ${path} (${response.status})`);
  }
  const result: unknown = await response.json();
  const payloadVersion =
    isRecord(result) && typeof result.version === "string" ? result.version : null;
  const nextVersion = payloadVersion ?? response.headers.get("etag");
  if (!nextVersion) throw new Error(`Missing file version while saving ${path}`);
  return nextVersion;
}

export async function syncProjectNotes(
  doc: NotesDoc,
  versions: FileVersions,
  locale: Locale,
  fetcher: FetchLike = fetch,
  deletedIds: ReadonlySet<string> = new Set(),
): Promise<NotesDoc> {
  let selected = doc;
  for (let retry = 0; ; retry += 1) {
    try {
      const nextVersion = await putFile(
        fetcher,
        selected.project,
        "review-notes.json",
        notesJson(selected),
        versions.get("review-notes.json") ?? null,
        false,
      );
      versions.set("review-notes.json", nextVersion);
      break;
    } catch (error) {
      if (!(error instanceof FileConflictError) || retry >= 2) throw error;
      const remote = await readProjectNotes(selected.project, fetcher);
      for (const [path, version] of remote.versions) versions.set(path, version);
      selected = mergeNotes(selected, remote.doc, deletedIds) ?? selected;
    }
  }
  const markdownVersion = await putFile(
    fetcher,
    selected.project,
    "review-notes.md",
    notesMarkdown(selected, locale),
    versions.get("review-notes.md") ?? null,
  );
  versions.set("review-notes.md", markdownVersion);
  return selected;
}

export function mergeNotes(
  local: NotesDoc | null,
  remote: NotesDoc | null,
  deletedIds: ReadonlySet<string> = new Set(),
): NotesDoc | null {
  const selected = chooseNotesDoc(local, remote);
  if (!selected) return null;
  const byId = new Map<string, NotesDoc["notes"][number]>();
  for (const note of [...(local?.notes ?? []), ...(remote?.notes ?? [])]) {
    if (deletedIds.has(note.id)) continue;
    const current = byId.get(note.id);
    if (!current || Date.parse(note.updatedAt) > Date.parse(current.updatedAt))
      byId.set(note.id, note);
  }
  const notes = sortNotes([...byId.values()]);
  if (
    notes.length === selected.notes.length &&
    notes.every((note, index) => note === selected.notes[index])
  )
    return selected;
  return { ...selected, notes };
}

export function needsMarkdownSync(
  markdown: string | null,
  selected: NotesDoc,
  locale: Locale,
): boolean {
  return markdown !== notesMarkdown(selected, locale);
}
