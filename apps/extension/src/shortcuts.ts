import type { PanelAction, PanelActionRef } from "./panel";
import { resizeActionForKey } from "./panel-layout";

export { isInteractiveShortcutTarget } from "./review/shortcut-target";

export function isShortcut(event: KeyboardEvent): PanelAction | null {
  const unmodified = !event.ctrlKey && !event.metaKey;
  if (event.altKey && unmodified && !event.shiftKey) {
    if (event.code === "KeyN") return "new";
    if (event.code === "KeyI") return "start";
    if (event.code === "KeyO") return "end";
    if (event.code === "KeyV") return "dictate";
    if (event.code === "KeyM") return "minimize";
  }
  if (event.altKey && event.shiftKey && unmodified && event.code === "KeyC") return "copy";
  return null;
}

export function handlePanelKeyboardEvent(
  event: KeyboardEvent,
  actionRef: PanelActionRef,
  activeHost: HTMLElement | null,
): boolean {
  if (actionRef.deleteAllDialogOpen) {
    event.stopImmediatePropagation();
    if (event.type === "keydown") {
      if (event.key === "Escape") {
        event.preventDefault();
        actionRef.current?.("escape");
      } else if (event.key === "Tab") {
        event.preventDefault();
        actionRef.current?.(event.shiftKey ? "dialog-tab-previous" : "dialog-tab-next");
      } else if (isShortcut(event)) {
        event.preventDefault();
      }
    }
    return true;
  }

  const path = event.composedPath();
  if (activeHost !== null && path.includes(activeHost)) {
    event.stopImmediatePropagation();
    if (event.type !== "keydown") return true;
    const target = path[0];
    const isEditor =
      target instanceof HTMLTextAreaElement ||
      (target instanceof HTMLInputElement && target.type === "text");
    if (event.key === "Escape") {
      event.preventDefault();
      actionRef.current?.("escape");
      return true;
    }
    if (target instanceof HTMLElement && target.classList.contains("fn-resize-handle")) {
      const resizeAction = resizeActionForKey(event);
      if (resizeAction) {
        event.preventDefault();
        event.stopPropagation();
        actionRef.current?.(resizeAction);
      }
      return true;
    }
    if (actionRef.languageMenuOpen) {
      const menuAction =
        event.key === "ArrowDown"
          ? "locale-next"
          : event.key === "ArrowUp"
            ? "locale-previous"
            : event.key === "Home"
              ? "locale-first"
              : event.key === "End"
                ? "locale-last"
                : null;
      if (menuAction) {
        event.preventDefault();
        actionRef.current?.(menuAction);
        return true;
      }
    }
    const action = isShortcut(event);
    if (action) {
      event.preventDefault();
      actionRef.current?.(action);
    } else if (event.key === "Enter" && !event.shiftKey && isEditor) {
      event.preventDefault();
      actionRef.current?.("save");
    }
    return true;
  }

  if (event.type !== "keydown") return false;
  const action = isShortcut(event);
  if (!action) return false;
  event.preventDefault();
  event.stopImmediatePropagation();
  actionRef.current?.(action);
  return true;
}
