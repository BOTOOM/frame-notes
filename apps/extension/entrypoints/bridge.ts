import { parseFps } from "../src/model";

interface PlayerElement extends HTMLElement {
  currentTime: number;
  duration: number;
  paused: boolean;
  seek: (seconds: number) => unknown;
  pause: () => unknown;
}

interface BridgeMessage {
  namespace?: string;
  kind?: string;
  nonce?: string;
  command?: string;
  time?: number;
}

const namespace = "frame-notes:v1";

export default defineUnlistedScript(() => {
  const nonce = document.currentScript?.getAttribute("data-frame-notes-nonce");
  if (!nonce || window.top !== window) return;

  let player: PlayerElement | null = null;
  let iframe: HTMLIFrameElement | null = null;
  let animationFrame = 0;
  let playerObserver: MutationObserver | null = null;
  let iframeObserver: MutationObserver | null = null;
  let originalSeek: PlayerElement["seek"] | null = null;
  let wrappedSeek: PlayerElement["seek"] | null = null;
  let disposed = false;

  const sendState = () => {
    if (!player || disposed) return;
    window.postMessage(
      {
        namespace,
        kind: "state",
        nonce,
        state: {
          currentTime: player.currentTime,
          duration: player.duration,
          paused: player.paused,
          fps: readFps(),
        },
      },
      location.origin,
    );
  };

  const scheduleState = () => {
    if (animationFrame || disposed) return;
    animationFrame = window.requestAnimationFrame(() => {
      animationFrame = 0;
      sendState();
    });
  };

  const seekPlayer = (seconds: number) => {
    if (!player) return;
    const duration = Number.isFinite(player.duration) ? Math.max(player.duration, 0) : 0;
    const time = Math.min(Math.max(Number.isFinite(seconds) ? seconds : 0, 0), duration);
    const input = document.querySelector<HTMLInputElement>('input[aria-label="Seek preview"]');
    if (!input || input.disabled) {
      player.seek(time);
      return;
    }
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (!valueSetter) return;
    valueSetter.call(input, String(time));
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const readFps = (): number => {
    if (!iframe) return 30;
    try {
      const frameDocument = iframe.contentDocument;
      const root =
        frameDocument?.querySelector('[data-root="true"]') ??
        frameDocument?.querySelector("[data-composition-id]");
      return parseFps(root?.getAttribute("data-fps"));
    } catch {
      return 30;
    }
  };

  const handleTimeUpdate = () => scheduleState();

  const detachIframe = () => {
    iframe?.removeEventListener("load", handleIframeLoad);
    iframeObserver?.disconnect();
    iframeObserver = null;
    iframe = null;
  };

  const attachIframe = (nextIframe: HTMLIFrameElement | null) => {
    if (iframe === nextIframe) return;
    detachIframe();
    iframe = nextIframe;
    if (!iframe) return;
    iframe.addEventListener("load", handleIframeLoad);
    handleIframeLoad();
  };

  function handleIframeLoad(): void {
    iframeObserver?.disconnect();
    try {
      const frameDocument = iframe?.contentDocument;
      if (frameDocument?.documentElement) {
        iframeObserver = new MutationObserver(scheduleState);
        iframeObserver.observe(frameDocument.documentElement, {
          attributes: true,
          childList: true,
          subtree: true,
          attributeFilter: ["data-fps"],
        });
      }
    } catch {
      iframeObserver = null;
    }
    scheduleState();
  }

  const detachPlayer = () => {
    if (!player) return;
    player.removeEventListener("timeupdate", handleTimeUpdate);
    if (originalSeek && wrappedSeek && player.seek === wrappedSeek) {
      player.seek = originalSeek;
    }
    playerObserver?.disconnect();
    playerObserver = null;
    detachIframe();
    player = null;
    originalSeek = null;
    wrappedSeek = null;
  };

  const attachPlayer = (nextPlayer: PlayerElement) => {
    const playerChanged = player !== nextPlayer;
    if (playerChanged) {
      detachPlayer();
      player = nextPlayer;
      player.addEventListener("timeupdate", handleTimeUpdate);
      const attachedPlayer = player;
      const originalSeekMethod = attachedPlayer.seek;
      originalSeek = originalSeekMethod;
      wrappedSeek = (seconds: number): unknown => {
        const result = originalSeekMethod.call(attachedPlayer, seconds);
        scheduleState();
        return result;
      };
      try {
        player.seek = wrappedSeek;
      } catch {
        wrappedSeek = null;
      }
      playerObserver = new MutationObserver(ensurePlayer);
      if (player.shadowRoot) {
        playerObserver.observe(player.shadowRoot, { childList: true, subtree: true });
      }
    }
    const nextIframe = nextPlayer.shadowRoot?.querySelector("iframe") ?? null;
    const iframeChanged = iframe !== nextIframe;
    attachIframe(nextIframe);
    if (playerChanged || iframeChanged) scheduleState();
  };

  function ensurePlayer(): void {
    if (disposed) return;
    const found = document.querySelector<PlayerElement>("hyperframes-player");
    if (!found) {
      detachPlayer();
      return;
    }
    attachPlayer(found);
  }

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    window.removeEventListener("message", handleMessage);
    documentObserver.disconnect();
    if (animationFrame) window.cancelAnimationFrame(animationFrame);
    detachPlayer();
  };

  function handleMessage(event: MessageEvent<BridgeMessage>): void {
    if (
      event.source !== window ||
      event.origin !== location.origin ||
      event.data?.namespace !== namespace ||
      event.data.nonce !== nonce
    ) {
      return;
    }
    if (event.data.kind !== "command") return;
    if (event.data.command === "getState") {
      sendState();
    } else if (event.data.command === "seek" && typeof event.data.time === "number") {
      seekPlayer(event.data.time);
      scheduleState();
    } else if (event.data.command === "pause") {
      player?.pause();
      scheduleState();
    } else if (event.data.command === "dispose") {
      dispose();
    }
  }

  const documentObserver = new MutationObserver(ensurePlayer);
  documentObserver.observe(document, { childList: true, subtree: true });
  window.addEventListener("message", handleMessage);
  ensurePlayer();
});
