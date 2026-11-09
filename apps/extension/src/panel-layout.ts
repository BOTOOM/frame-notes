export const minListHeight = 96;

export function clampListHeight(height: number, available: number): number {
  if (available < minListHeight) return Math.max(0, Math.round(available));

  return Math.round(Math.max(minListHeight, Math.min(height, available)));
}

export type ResizeKeyAction =
  | "resize-up"
  | "resize-up-fast"
  | "resize-down"
  | "resize-down-fast"
  | "resize-min"
  | "resize-max"
  | "resize-reset";

interface ResizeKeyboardEvent {
  key: string;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

export function resizeActionForKey(event: ResizeKeyboardEvent): ResizeKeyAction | null {
  if (event.altKey || event.ctrlKey || event.metaKey) return null;
  switch (event.key) {
    case "ArrowUp":
      return event.shiftKey ? "resize-up-fast" : "resize-up";
    case "ArrowDown":
      return event.shiftKey ? "resize-down-fast" : "resize-down";
    case "Home":
      return "resize-min";
    case "End":
      return "resize-max";
    case "Enter":
      return "resize-reset";
    default:
      return null;
  }
}

export function isResizeKeyAction(action: string): action is ResizeKeyAction {
  switch (action) {
    case "resize-up":
    case "resize-up-fast":
    case "resize-down":
    case "resize-down-fast":
    case "resize-min":
    case "resize-max":
    case "resize-reset":
      return true;
    default:
      return false;
  }
}
