type ShortcutAction = "new" | "start" | "end" | "copy" | "minimize";

const namespace = "frame-notes:v1";
const commandActions: Record<string, ShortcutAction> = {
  "new-note": "new",
  "set-start": "start",
  "set-end": "end",
  "copy-notes": "copy",
  "toggle-panel": "minimize",
};

export default defineBackground(() => {
  browser.commands.onCommand.addListener(async (command) => {
    const action = commandActions[command];
    if (!action) return;
    const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab?.id === undefined) return;
    try {
      await browser.tabs.sendMessage(tab.id, {
        namespace,
        type: "shortcut",
        action,
      });
    } catch {
      // Commands are only actionable in a Studio tab with the content script loaded.
    }
  });
});
