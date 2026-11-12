import { createSpeechCommandHandler } from "../src/dictation/local-speech";
import type { SpeechBridgeEvent, SpeechBridgeRequest } from "../src/dictation/protocol";
import { parseFps } from "../src/model";

interface PlayerElement extends HTMLElement {
  currentTime: number;
  duration: number;
  paused: boolean;
  seek: (seconds: number) => unknown;
  play: () => unknown;
  pause: () => unknown;
}

interface LoopingRange {
  id: string;
  start: number;
  end: number;
}

interface BridgeMessage {
  namespace?: string;
  kind?: string;
  nonce?: string;
  command?: string;
  time?: number;
  loop?: LoopingRange;
  speechCommand?: SpeechBridgeRequest;
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
  let loopingRange: LoopingRange | null = null;
  let loopAnimationFrame = 0;
  let lastLoopSeekAt = 0;
  let pausedSince: number | null = null;
  let loopWasPaused: boolean | null = null;
  let studioLoopActive = false;
  let studioLoopEnabledByExtension = false;
  let loopSeekInProgress = false;
  let speechSessionId: string | null = null;
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
          loopingRange,
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

  const sendSpeechEvent = (speechEvent: SpeechBridgeEvent) => {
    if (disposed) return;
    window.postMessage({ namespace, kind: "speech-event", nonce, speechEvent }, location.origin);
  };
  const handleSpeechCommand = createSpeechCommandHandler(window, sendSpeechEvent);

  const dispatchStudioShortcut = (key: string, code: string, shiftKey = false): boolean => {
    if (!document.body) return false;
    const event = new KeyboardEvent("keydown", {
      key,
      code,
      shiftKey,
      bubbles: true,
      cancelable: true,
      composed: true,
    });
    document.body.dispatchEvent(event);
    return event.defaultPrevented;
  };

  const stopLoop = (restorePlayback = true) => {
    if (!loopingRange) return;
    const wasPaused = loopWasPaused;
    if (studioLoopActive) {
      dispatchStudioShortcut("I", "KeyI", true);
      dispatchStudioShortcut("O", "KeyO", true);
      const loopButton = document.querySelector<HTMLButtonElement>(
        'button[aria-label="Enable loop playback"], button[aria-label="Disable loop playback"]',
      );
      if (studioLoopEnabledByExtension && loopButton?.getAttribute("aria-pressed") === "true") {
        dispatchStudioShortcut("L", "KeyL", true);
      }
      studioLoopActive = false;
      studioLoopEnabledByExtension = false;
    }
    loopingRange = null;
    loopWasPaused = null;
    pausedSince = null;
    if (loopAnimationFrame) window.cancelAnimationFrame(loopAnimationFrame);
    loopAnimationFrame = 0;
    scheduleState();
    if (restorePlayback && wasPaused !== null) {
      if (wasPaused) pausePlayer();
      else resumePlayer();
    }
  };

  const seekPlayer = (seconds: number, isLoopSeek = false) => {
    if (!player) return;
    if (!isLoopSeek) stopLoop();
    const duration = Number.isFinite(player.duration) ? Math.max(player.duration, 0) : 0;
    const time = Math.min(Math.max(Number.isFinite(seconds) ? seconds : 0, 0), duration);
    const input = document.querySelector<HTMLInputElement>('input[aria-label="Seek preview"]');
    loopSeekInProgress = isLoopSeek;
    try {
      if (!input || input.disabled) {
        player.seek(time);
        return;
      }
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      if (!valueSetter) return;
      valueSetter.call(input, String(time));
      input.dispatchEvent(new Event("input", { bubbles: true }));
    } finally {
      loopSeekInProgress = false;
    }
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

  const resumePlayer = () => {
    const button = document.querySelector<HTMLButtonElement>('button[aria-label="Play"]');
    if (button && !button.disabled) {
      if (!dispatchStudioShortcut(" ", "Space")) button.click();
      return;
    }
    if (player?.paused) player.play();
  };

  const pausePlayer = () => {
    if (!player || player.paused) return;
    const button = document.querySelector<HTMLButtonElement>('button[aria-label="Pause"]');
    if (button && !button.disabled) {
      if (!dispatchStudioShortcut(" ", "Space")) button.click();
      return;
    }
    player.pause();
  };

  const startStudioLoop = (start: number, end: number): boolean => {
    const loopButton = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Enable loop playback"], button[aria-label="Disable loop playback"]',
    );
    const loopWasEnabled = loopButton?.getAttribute("aria-pressed") === "true";
    if (!loopWasEnabled && !dispatchStudioShortcut("L", "KeyL", true)) return false;
    const restoreLoopState = () => {
      if (!loopWasEnabled) dispatchStudioShortcut("L", "KeyL", true);
    };
    seekPlayer(start, true);
    if (!dispatchStudioShortcut("i", "KeyI")) {
      restoreLoopState();
      return false;
    }
    seekPlayer(end, true);
    if (!dispatchStudioShortcut("o", "KeyO")) {
      restoreLoopState();
      return false;
    }
    seekPlayer(start, true);
    studioLoopEnabledByExtension = !loopWasEnabled;
    return true;
  };

  const runLoopFrame = () => {
    loopAnimationFrame = 0;
    const range = loopingRange;
    if (!range || !player || disposed) return;

    const now = performance.now();
    if (player.paused) {
      if (now - lastLoopSeekAt > 2_500) {
        pausedSince ??= now;
        if (now - pausedSince > 500) {
          stopLoop(false);
          return;
        }
      } else {
        pausedSince = null;
      }
    } else {
      pausedSince = null;
    }

    if (player.currentTime >= range.end - 0.5 / Math.max(readFps(), 1)) {
      lastLoopSeekAt = now;
      pausedSince = null;
      seekPlayer(range.start, true);
      resumePlayer();
      scheduleState();
    }

    if (loopingRange) loopAnimationFrame = window.requestAnimationFrame(runLoopFrame);
  };

  const scheduleLoopFrame = () => {
    if (loopingRange && !loopAnimationFrame) {
      loopAnimationFrame = window.requestAnimationFrame(runLoopFrame);
    }
  };

  const startLoop = (requested: LoopingRange) => {
    if (!player || !Number.isFinite(requested.start) || !Number.isFinite(requested.end)) return;
    const duration = Number.isFinite(player.duration) ? Math.max(player.duration, 0) : 0;
    const start = Math.min(Math.max(requested.start, 0), duration);
    const end = Math.min(Math.max(requested.end, 0), duration);
    if (end <= start) return;

    stopLoop();
    loopingRange = { id: requested.id, start, end };
    loopWasPaused = player.paused;
    lastLoopSeekAt = performance.now();
    pausedSince = null;
    if (startStudioLoop(start, end)) {
      studioLoopActive = true;
      resumePlayer();
      scheduleState();
      return;
    }
    seekPlayer(start, true);
    resumePlayer();
    scheduleState();
    scheduleLoopFrame();
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
    stopLoop();
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
        if (loopingRange && !loopSeekInProgress) stopLoop();
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
    if (speechSessionId) {
      void handleSpeechCommand({ type: "cancel", sessionId: speechSessionId });
      speechSessionId = null;
    }
    speechSessionId = null;
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
    if (event.data.command === "speech" && event.data.speechCommand) {
      if (event.data.speechCommand.type === "start") {
        speechSessionId = event.data.speechCommand.sessionId;
      } else if (
        event.data.speechCommand.type === "cancel" &&
        speechSessionId === event.data.speechCommand.sessionId
      ) {
        speechSessionId = null;
      }
      void handleSpeechCommand(event.data.speechCommand);
    } else if (event.data.command === "getState") {
      sendState();
    } else if (event.data.command === "seek" && typeof event.data.time === "number") {
      seekPlayer(event.data.time);
      scheduleState();
    } else if (event.data.command === "loop" && event.data.loop) {
      startLoop(event.data.loop);
    } else if (event.data.command === "stopLoop") {
      stopLoop();
    } else if (event.data.command === "pause") {
      stopLoop();
      pausePlayer();
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
