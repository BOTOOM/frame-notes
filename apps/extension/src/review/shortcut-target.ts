const interactiveShortcutTags = new Set(["A", "BUTTON", "INPUT", "SELECT", "SUMMARY", "TEXTAREA"]);

export function isInteractiveShortcutTarget(tagName: string, role: string | null): boolean {
  return interactiveShortcutTags.has(tagName.toUpperCase()) || role?.toLowerCase() === "button";
}
