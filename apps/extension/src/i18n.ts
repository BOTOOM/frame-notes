import type { Locale } from "./model";

const strings = {
  en: {
    addNote: "+ Note",
    appName: "Frame Notes",
    cancel: "Cancel",
    copied: "Copied",
    copyFailed: "Could not copy",
    copyAll: "Copy all",
    delete: "Delete",
    deleted: "Note deleted",
    detected: "HyperFrames Studio detected",
    edit: "Edit note",
    emptyBody: "Press Alt+N to capture a thought at the playhead.",
    emptyTitle: "No review notes yet",
    end: "End",
    expand: "Expand panel",
    finishEditing: "Save or cancel the current edit first.",
    invalidTime: "Enter a time such as 00:12.500 or f375.",
    localOnly: "Local only",
    markersLabel: "Review note markers",
    minimize: "Minimize panel",
    notePlaceholder: "What should change here?",
    notes: "notes",
    now: "← now",
    removeEnd: "Remove end",
    save: "Save",
    saving: "Saving…",
    shortcuts:
      "Alt+N new · Alt+I/O range · Enter save · Shift+Enter newline · Esc cancel · Alt+Shift+C copy · Alt+M minimize",
    start: "Start",
    synced: "Synced to project",
    undo: "Undo",
    unsupported: "Open a HyperFrames Studio preview to use Frame Notes.",
    unknownProject: "Studio tab",
  },
  es: {
    addNote: "+ Nota",
    appName: "Frame Notes",
    cancel: "Cancelar",
    copied: "Copiado",
    copyFailed: "No se pudo copiar",
    copyAll: "Copiar todo",
    delete: "Eliminar",
    deleted: "Nota eliminada",
    detected: "HyperFrames Studio detectado",
    edit: "Editar nota",
    emptyBody: "Pulsa Alt+N para anotar en el cabezal de reproducción.",
    emptyTitle: "Todavía no hay notas",
    end: "Fin",
    expand: "Expandir panel",
    finishEditing: "Guarda o cancela la edición actual primero.",
    invalidTime: "Escribe un tiempo como 00:12.500 o f375.",
    localOnly: "Solo local",
    markersLabel: "Marcadores de notas de revisión",
    minimize: "Minimizar panel",
    notePlaceholder: "¿Qué debería cambiar aquí?",
    notes: "notas",
    now: "← ahora",
    removeEnd: "Quitar fin",
    save: "Guardar",
    saving: "Guardando…",
    shortcuts:
      "Alt+N nueva · Alt+I/O rango · Enter guardar · Mayús+Enter salto · Esc cancelar · Alt+Mayús+C copiar · Alt+M minimizar",
    start: "Inicio",
    synced: "Sincronizado con el proyecto",
    undo: "Deshacer",
    unsupported: "Abre una vista previa de HyperFrames Studio para usar Frame Notes.",
    unknownProject: "Pestaña de Studio",
  },
} satisfies Record<Locale, Record<string, string>>;

export function currentLocale(language = navigator.language): Locale {
  return language.toLowerCase().startsWith("es") ? "es" : "en";
}

export function t(key: keyof typeof strings.en, locale = currentLocale()): string {
  return strings[locale][key];
}

export function copyHeader(project: string, count: number, fps: number, locale: Locale): string {
  const label = Number.isInteger(fps) ? String(fps) : String(Number(fps.toFixed(3)));
  return locale === "es"
    ? `Notas de revisión — ${project} (${count} notas, ${label} fps)`
    : `Review notes — ${project} (${count} notes, ${label} fps)`;
}
