import { registerWhisperHost } from "../src/dictation/whisper-host";

type ShortcutAction = "new" | "start" | "end" | "copy" | "minimize";
const namespace = "frame-notes:v1";

const commandActions: Record<string, ShortcutAction> = {
  "new-note": "new",
  "set-start": "start",
  "set-end": "end",
  "copy-notes": "copy",
  "toggle-panel": "minimize",
};

function isReadyResponse(value: unknown): boolean {
  return typeof value === "object" && value !== null && Reflect.get(value, "ready") === true;
}

async function getOffscreenContextCount(): Promise<number> {
  if (typeof browser.runtime.getContexts !== "function")
    return Promise.reject(new Error("getContexts unavailable"));
  const contexts = await browser.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [browser.runtime.getURL("/offscreen.html")],
  });
  return contexts.length;
}

async function createOffscreenDocument(): Promise<void> {
  if (typeof browser.offscreen?.createDocument !== "function")
    throw new Error("offscreen API unavailable");
  await browser.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["WORKERS"],
    justification: "Run the local Whisper speech model",
  });
}

async function pingOffscreenHost(): Promise<unknown> {
  try {
    return await browser.runtime.sendMessage({ type: "frame-notes:whisper-host-ping" });
  } catch {
    return undefined;
  }
}

function registerChromeWhisperHostManager(): void {
  let ready = false;
  let ensurePromise: Promise<void> | null = null;
  let resolveReady: (() => void) | null = null;
  let connectedWhisperPorts = 0;
  let ensureRequests = 0;
  let closePromise: Promise<void> | null = null;

  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== "frame-notes-whisper") return;
    connectedWhisperPorts += 1;
    port.onDisconnect.addListener(() => {
      connectedWhisperPorts = Math.max(0, connectedWhisperPorts - 1);
    });
  });

  const waitForReady = () => {
    if (ready) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        resolveReady = null;
        reject(new Error("Whisper offscreen host did not become ready"));
      }, 15_000);
      resolveReady = () => {
        clearTimeout(timer);
        resolveReady = null;
        resolve();
      };
    });
  };

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (typeof message !== "object" || message === null) return;
    const type = Reflect.get(message, "type");
    if (type === "frame-notes:whisper-host-ready") {
      ready = true;
      resolveReady?.();
      return;
    }
    if (type === "frame-notes:whisper-host-idle") {
      if (connectedWhisperPorts !== 0 || ensureRequests !== 0 || closePromise) return;
      closePromise = (async () => {
        if (
          (await getOffscreenContextCount()) === 0 ||
          connectedWhisperPorts !== 0 ||
          ensureRequests !== 0
        )
          return;
        if (typeof browser.offscreen?.closeDocument !== "function")
          throw new Error("offscreen API unavailable");
        await browser.offscreen.closeDocument();
        ready = false;
      })().finally(() => {
        closePromise = null;
      });
      void closePromise.then(
        () => sendResponse({ ok: true }),
        () => sendResponse({ ok: false }),
      );
      return true;
    }
    if (type !== "frame-notes:ensure-whisper-host") return;

    ensureRequests += 1;
    ensurePromise ??= (async () => {
      await closePromise;
      if (ready) return;
      const existingContexts = await getOffscreenContextCount();
      if (existingContexts > 0) {
        const response = await pingOffscreenHost();
        if (isReadyResponse(response)) {
          ready = true;
          return;
        }
      }
      const readyPromise = waitForReady();
      if (existingContexts === 0) {
        try {
          await createOffscreenDocument();
        } catch (error) {
          if ((await getOffscreenContextCount()) === 0) throw error;
          const response = await pingOffscreenHost();
          if (isReadyResponse(response)) {
            ready = true;
            return;
          }
        }
      }
      await readyPromise;
    })().finally(() => {
      ensurePromise = null;
    });
    void ensurePromise.then(
      () => {
        ensureRequests = Math.max(0, ensureRequests - 1);
        sendResponse({ ok: true });
      },
      (error: unknown) => {
        ensureRequests = Math.max(0, ensureRequests - 1);
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : "Whisper host unavailable",
        });
      },
    );
    return true;
  });
}

export default defineBackground(() => {
  if (browser.runtime.getManifest().manifest_version === 2) {
    registerWhisperHost();
  } else {
    registerChromeWhisperHostManager();
  }

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
