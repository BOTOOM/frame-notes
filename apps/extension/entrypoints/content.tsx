import { createRoot } from "react-dom/client";
import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root";
import { injectScript } from "wxt/utils/inject-script";
import { currentLocale } from "../src/i18n";
import { parseFps } from "../src/model";
import { NotePanel, type PanelAction, type PanelActionRef } from "../src/panel";
import { NoteSession, type PlayerState } from "../src/session";
import "../src/content.css";

interface BridgeEnvelope {
  namespace?: string;
  kind?: string;
  nonce?: string;
  state?: PlayerState;
  command?: string;
  time?: number;
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

function isShortcut(event: KeyboardEvent): PanelAction | null {
  const unmodified = !event.ctrlKey && !event.metaKey;
  if (event.altKey && unmodified && !event.shiftKey) {
    if (event.code === "KeyN") return "new";
    if (event.code === "KeyI") return "start";
    if (event.code === "KeyO") return "end";
    if (event.code === "KeyM") return "minimize";
  }
  if (event.altKey && event.shiftKey && unmodified && event.code === "KeyC") return "copy";
  return null;
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
        if (!action || !window.top || location.origin !== window.location.origin) return;
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
    let activeHost: HTMLElement | null = null;
    let generation = 0;
    let disposed = false;

    const postBridge = (message: Omit<BridgeEnvelope, "namespace" | "nonce">) => {
      window.postMessage({ namespace, nonce, ...message }, location.origin);
    };

    const removeStudio = () => {
      generation += 1;
      activeUi?.remove();
      activeUi = null;
      activeHost = null;
      actionRef.current = null;
      session?.dispose();
      session = null;
      activeProject = null;
    };

    const handleShortcut = (event: KeyboardEvent) => {
      const path = event.composedPath();
      const fromPanel = activeHost !== null && path.includes(activeHost);
      if (fromPanel) {
        event.stopImmediatePropagation();
        if (event.type !== "keydown") return;
        const action = isShortcut(event);
        if (action) {
          event.preventDefault();
          actionRef.current?.(action);
        } else if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          actionRef.current?.("save");
        } else if (event.key === "Escape") {
          event.preventDefault();
          actionRef.current?.("cancel");
        }
        return;
      }
      if (event.type !== "keydown") return;
      const action = isShortcut(event);
      if (!action) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      actionRef.current?.(action);
    };

    ctx.addEventListener(window, "keydown", handleShortcut, { capture: true });
    ctx.addEventListener(window, "keyup", handleShortcut, { capture: true });
    ctx.addEventListener(window, "keypress", handleShortcut, { capture: true });

    const reconcile = () => {
      if (disposed) return;
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
        (command, time) => postBridge({ kind: "command", command, time }),
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
          } else activeHost = container.parentElement;
          const root = createRoot(container);
          root.render(
            <NotePanel
              session={controller}
              project={project}
              actionRef={actionRef}
              storageKey={`${controller.storageKey}:panel`}
            />,
          );
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
      if (event.source !== window || event.origin !== location.origin) return;
      const message = event.data;
      if (
        message?.namespace === namespace &&
        message.nonce === nonce &&
        message.kind === "state" &&
        message.state
      ) {
        const playerState: PlayerState = {
          currentTime: Number(message.state.currentTime) || 0,
          duration: Number(message.state.duration) || 0,
          paused: Boolean(message.state.paused),
          fps: parseFps(String(message.state.fps ?? 30)),
        };
        session?.setPlayerState(playerState);
        return;
      }
      if (
        message?.namespace === namespace &&
        message.kind === "frame-command" &&
        event.origin === location.origin &&
        sameOriginFrame(event.source) &&
        message.action
      ) {
        actionRef.current?.(message.action);
      }
    };
    ctx.addEventListener(window, "message", handlePageMessage);
    ctx.addEventListener(window, "hashchange", reconcile);
    ctx.addEventListener(window, "wxt:locationchange", reconcile);

    ctx.onInvalidated(() => {
      disposed = true;
      removeStudio();
      postBridge({ kind: "command", command: "dispose" });
    });

    const runtimeListener = (message: unknown): unknown => {
      if (!isExtensionRequest(message)) return undefined;
      if (message.type === "status") {
        const state = session?.getSnapshot();
        const status: StudioStatus = {
          detected: Boolean(state),
          project: state?.doc.project ?? null,
          noteCount: state?.doc.notes.length ?? 0,
        };
        return Promise.resolve(status);
      }
      if (message.type === "copy") {
        actionRef.current?.("copy");
        return Promise.resolve({ ok: Boolean(session) });
      }
      if (message.type === "shortcut" && message.action) {
        actionRef.current?.(message.action);
        return Promise.resolve({ ok: Boolean(session) });
      }
      return undefined;
    };
    browser.runtime.onMessage.addListener(runtimeListener);
    ctx.onInvalidated(() => browser.runtime.onMessage.removeListener(runtimeListener));

    const mutationObserver = new MutationObserver(reconcile);
    mutationObserver.observe(document, { childList: true, subtree: true });
    ctx.onInvalidated(() => mutationObserver.disconnect());

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
