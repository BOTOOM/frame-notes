import { createRoot } from "react-dom/client";
import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root";
import { injectScript } from "wxt/utils/inject-script";
import type {
  SpeechBridge,
  SpeechBridgeEvent,
  SpeechBridgeRequest,
} from "../src/dictation/protocol";
import { currentLocale, startLocalePreferenceWatch, subscribeLocale } from "../src/i18n";
import { parseFps } from "../src/model";
import { NotePanel, type PanelAction, type PanelActionRef } from "../src/panel";
import { NoteSession, type PlayerCommandValue, type PlayerState } from "../src/session";
import { handlePanelKeyboardEvent, isShortcut } from "../src/shortcuts";
import "../src/content.css";

interface BridgeEnvelope {
  namespace?: string;
  kind?: string;
  nonce?: string;
  state?: PlayerState;
  command?: string;
  time?: number;
  loop?: PlayerState["loopingRange"];
  speechCommand?: SpeechBridgeRequest;
  speechEvent?: SpeechBridgeEvent;
  action?: PanelAction;
}

interface ExtensionRequest {
  namespace?: string;
  type?: string;
  action?: PanelAction;
}

interface StudioStatus {
  detected: boolean;
  project: string | null;
  noteCount: number;
  copyText?: string;
}

const namespace = "frame-notes:v1";
const matchPatterns = ["http://localhost/*", "http://127.0.0.1/*"];

function isExtensionRequest(value: unknown): value is ExtensionRequest {
  return (
    value !== null &&
    typeof value === "object" &&
    "namespace" in value &&
    value.namespace === namespace
  );
}

function projectFromHash(hash: string): string | null {
  const match = hash.match(/^#project\/([^?]+)/);
  if (!match) return null;
  try {
    const encodedProject = match[1];
    return encodedProject ? decodeURIComponent(encodedProject) : null;
  } catch {
    return null;
  }
}

function sameOriginFrame(source: MessageEventSource | null): boolean {
  if (!source || source === window) return false;
  try {
    return "location" in source && source.location.origin === location.origin;
  } catch {
    return false;
  }
}

export default defineContentScript({
  matches: matchPatterns,
  runAt: "document_start",
  allFrames: true,
  cssInjectionMode: "ui",
  main(ctx) {
    const isTopFrame = window === window.top;
    const actionRef: PanelActionRef = { current: null };

    if (!isTopFrame) {
      const forwardFrameShortcut = (event: KeyboardEvent) => {
        const action = isShortcut(event);
        if (!action || !window.top) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        window.top.postMessage({ namespace, kind: "frame-command", action }, location.origin);
      };
      ctx.addEventListener(window, "keydown", forwardFrameShortcut, { capture: true });
      return;
    }

    const nonce = crypto.randomUUID();
    let activeProject: string | null = null;
    let session: NoteSession | null = null;
    let activeUi: Awaited<ReturnType<typeof createShadowRootUi>> | null = null;
    startLocalePreferenceWatch();
    const unsubscribeLocale = subscribeLocale(() => session?.setLocale(currentLocale()));
    let activeHost: HTMLElement | null = null;
    let generation = 0;
    let disposed = false;

    const postBridge = (message: Omit<BridgeEnvelope, "namespace" | "nonce">) => {
      window.postMessage({ namespace, nonce, ...message }, location.origin);
    };
    const speechListeners = new Set<(event: SpeechBridgeEvent) => void>();
    const speechBridge: SpeechBridge = {
      send: (speechCommand) => postBridge({ kind: "command", command: "speech", speechCommand }),
      subscribe: (listener) => {
        speechListeners.add(listener);
        return () => speechListeners.delete(listener);
      },
    };

    const syncStudioTheme = () => {
      if (!activeHost) return;
      if (document.documentElement.dataset.theme === "paper") activeHost.dataset.theme = "paper";
      else activeHost.removeAttribute("data-theme");
    };
    let themeObserver: MutationObserver | null = null;
    const ensureThemeObserver = () => {
      const root = document.documentElement;
      if (!root || themeObserver || disposed) return;
      const observer = new MutationObserver(syncStudioTheme);
      try {
        observer.observe(root, {
          attributes: true,
          attributeFilter: ["data-theme"],
        });
        themeObserver = observer;
      } catch {
        observer.disconnect();
      }
    };

    const removeStudio = () => {
      generation += 1;
      activeUi?.remove();
      activeUi = null;
      activeHost = null;
      actionRef.current = null;
      actionRef.languageMenuOpen = false;
      actionRef.deleteAllDialogOpen = false;
      session?.dispose();
      session = null;
      activeProject = null;
    };

    const handleShortcut = (event: KeyboardEvent) =>
      handlePanelKeyboardEvent(event, actionRef, activeHost);

    ctx.addEventListener(window, "keydown", handleShortcut, { capture: true });
    ctx.addEventListener(window, "keyup", handleShortcut, { capture: true });
    ctx.addEventListener(window, "keypress", handleShortcut, { capture: true });

    const reconcile = () => {
      if (disposed) return;
      ensureThemeObserver();
      const player = document.querySelector("hyperframes-player");
      const project = projectFromHash(location.hash);
      if (!player || !project) {
        if (activeUi || session) removeStudio();
        return;
      }
      if (project === activeProject && session) return;
      removeStudio();
      activeProject = project;
      const ownGeneration = generation;
      const controller = new NoteSession(
        project,
        location.origin,
        (command, value?: PlayerCommandValue) =>
          postBridge({
            kind: "command",
            command,
            ...(typeof value === "number" ? { time: value } : { loop: value }),
          }),
        currentLocale(),
      );
      session = controller;
      void controller.load();

      void createShadowRootUi(ctx, {
        name: "frame-notes",
        position: "overlay",
        anchor: "body",
        onMount(container) {
          const rootNode = container.getRootNode();
          if (rootNode instanceof ShadowRoot) {
            activeHost = rootNode.host instanceof HTMLElement ? rootNode.host : null;
          } else {
            activeHost = container.parentElement;
          }
          const root = createRoot(container);
          root.render(
            <NotePanel
              session={controller}
              project={project}
              actionRef={actionRef}
              speechBridge={speechBridge}
              storageKey={`${controller.storageKey}:panel`}
            />,
          );
          syncStudioTheme();
          return root;
        },
        onRemove(root) {
          root?.unmount();
        },
      }).then((ui) => {
        if (disposed || ownGeneration !== generation || controller !== session) {
          ui.remove();
          return;
        }
        activeUi = ui;
        ui.mount();
        postBridge({ kind: "command", command: "getState" });
      });
    };

    const handlePageMessage = (event: MessageEvent<BridgeEnvelope>) => {
      const message = event.data;
      if (message?.namespace !== namespace) return;
      if (message.kind === "frame-command") {
        if (event.origin !== location.origin || !sameOriginFrame(event.source) || !message.action) {
          return;
        }
        if (actionRef.deleteAllDialogOpen) return;
        actionRef.current?.(message.action);
        return;
      }
      if (
        event.source === window &&
        event.origin === location.origin &&
        message.nonce === nonce &&
        message.kind === "speech-event" &&
        message.speechEvent
      ) {
        for (const listener of speechListeners) listener(message.speechEvent);
        return;
      }
      if (
        event.source !== window ||
        event.origin !== location.origin ||
        message.nonce !== nonce ||
        message.kind !== "state" ||
        !message.state
      ) {
        return;
      }
      const playerState: PlayerState = {
        currentTime: Number(message.state.currentTime) || 0,
        duration: Number(message.state.duration) || 0,
        paused: Boolean(message.state.paused),
        fps: parseFps(String(message.state.fps ?? 30)),
        loopingRange:
          message.state.loopingRange &&
          typeof message.state.loopingRange.id === "string" &&
          Number.isFinite(message.state.loopingRange.start) &&
          Number.isFinite(message.state.loopingRange.end)
            ? message.state.loopingRange
            : null,
      };
      session?.setPlayerState(playerState);
    };
    ctx.addEventListener(window, "message", handlePageMessage);
    ctx.addEventListener(window, "hashchange", reconcile);
    ctx.addEventListener(window, "wxt:locationchange", reconcile);

    ctx.onInvalidated(() => {
      disposed = true;
      unsubscribeLocale();
      removeStudio();
      postBridge({ kind: "command", command: "dispose" });
    });

    const runtimeListener: Parameters<typeof browser.runtime.onMessage.addListener>[0] = (
      message,
      _sender,
      sendResponse,
    ) => {
      if (!isExtensionRequest(message)) return false;
      if (message.type === "status") {
        const state = session?.getSnapshot();
        const status: StudioStatus = {
          detected: Boolean(state),
          project: state?.doc.project ?? null,
          noteCount: state?.doc.notes.length ?? 0,
        };
        sendResponse(status);
        return true;
      }
      if (message.type === "copy") {
        actionRef.current?.("copy");
        sendResponse({ ok: Boolean(session) });
        return true;
      }
      if (message.type === "shortcut" && message.action) {
        actionRef.current?.(message.action);
        sendResponse({ ok: Boolean(session) });
        return true;
      }
      return false;
    };
    browser.runtime.onMessage.addListener(runtimeListener);
    ctx.onInvalidated(() => browser.runtime.onMessage.removeListener(runtimeListener));

    const mutationObserver = new MutationObserver(reconcile);
    mutationObserver.observe(document, { childList: true, subtree: true });
    ctx.onInvalidated(() => mutationObserver.disconnect());
    ensureThemeObserver();
    ctx.onInvalidated(() => themeObserver?.disconnect());

    void injectScript("/bridge.js", {
      keepInDom: false,
      modifyScript(script) {
        script.setAttribute("data-frame-notes-nonce", nonce);
      },
    }).then(
      () => postBridge({ kind: "command", command: "getState" }),
      () => undefined,
    );
    reconcile();
  },
});
