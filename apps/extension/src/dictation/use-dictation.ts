import { useCallback, useEffect, useRef, useState } from "react";
import { storage } from "wxt/utils/storage";
import type { Locale } from "../model";
import {
  chunkPcm,
  type DictationEngine,
  type DictationEngineChoice,
  selectDictationEngine,
  speechLanguageCandidates,
} from "./helpers";
import { whisperConsentStorageKey } from "./preferences";
import type {
  SpeechAvailability,
  SpeechBridge,
  SpeechBridgeEvent,
  SpeechBridgeRequest,
  SpeechLanguageAvailability,
} from "./protocol";
import {
  checkSpeechLanguages,
  findSpeechRecognitionApi,
  type SpeechRecognitionConstructor,
  type SpeechRecognitionInstance,
  startLocalRecognition,
} from "./speech";
import { type PcmCapture, startPcmCapture } from "./whisper-audio";

export type DictationPhase =
  | "idle"
  | "preparing"
  | "listening"
  | "transcribing"
  | "consent-language"
  | "consent-model"
  | "error";

export type DictationError =
  | "dictationUnsupported"
  | "dictationPackFailed"
  | "dictationPermission"
  | "dictationFailed"
  | "dictationWhisperUnavailable";

export interface DictationView {
  phase: DictationPhase;
  engine: DictationEngine | null;
  world: "isolated" | "main" | null;
  language: string | null;
  availability: SpeechAvailability | null;
  installResult: "not-requested" | "installed" | "failed";
  interim: string;
  progress: number | null;
  error: DictationError | null;
  modelConsentRequired: boolean;
  device: "webgpu" | "wasm" | null;
  dtype: string | null;
  apiSupported: boolean | null;
  probeResults: SpeechLanguageAvailability[];
}

export interface DictationController {
  view: DictationView;
  isActive: boolean;
  start: () => void;
  stop: () => void;
  cancel: () => void;
  installLanguagePack: () => void;
  cancelLanguagePack: () => void;
  consentToWhisper: () => void;
  switchToWhisper: () => void;
}

interface UseDictationOptions {
  locale: Locale;
  engineChoice: DictationEngineChoice;
  bridge: SpeechBridge;
  pauseVideo: () => void;
  insertText: (text: string) => void;
}

interface PendingRequest {
  resolve: (event: SpeechBridgeEvent) => void;
  timer: number;
}

interface PendingPack {
  language: string;
  world: "isolated" | "main";
  generation: number;
}

type PackInstallOutcome =
  | { kind: "finished"; installed: boolean }
  | { kind: "timeout" }
  | { kind: "cancelled" };

function cancelMainInstallRequest(
  pendingRequests: Map<string, PendingRequest>,
  requestId: string,
  language: string,
): void {
  const pending = pendingRequests.get(requestId);
  if (!pending) return;
  clearTimeout(pending.timer);
  pendingRequests.delete(requestId);
  pending.resolve({ type: "install-result", requestId, language, installed: false });
}

type ExtensionRuntimePort = Parameters<
  Parameters<typeof browser.runtime.onConnect.addListener>[0]
>[0];

interface WhisperSession {
  port: ExtensionRuntimePort;
  recorder: PcmCapture | null;
  keepAlive: number;
  generation: number;
  rejectReady: ((error: Error) => void) | null;
}

function emptyView(phase: DictationPhase = "idle"): DictationView {
  return {
    phase,
    engine: null,
    world: null,
    language: null,
    availability: null,
    installResult: "not-requested",
    interim: "",
    progress: null,
    error: null,
    modelConsentRequired: false,
    device: null,
    dtype: null,
    apiSupported: null,
    probeResults: [],
  };
}

function chooseLanguage(
  availabilities: SpeechLanguageAvailability[],
): SpeechLanguageAvailability | null {
  return (
    availabilities.find((result) => result.availability === "available") ??
    availabilities.find(
      (result) => result.availability === "downloadable" || result.availability === "downloading",
    ) ??
    null
  );
}

function errorFromSpeechCode(code: string): DictationError {
  if (code === "not-allowed" || code === "service-not-allowed") return "dictationPermission";
  if (code === "unsupported") return "dictationUnsupported";
  return "dictationFailed";
}

export function useDictation({
  locale,
  engineChoice,
  bridge,
  pauseVideo,
  insertText,
}: UseDictationOptions): DictationController {
  const [view, setView] = useState<DictationView>(() => emptyView());
  const [isolatedApi] = useState<SpeechRecognitionConstructor | null>(() =>
    findSpeechRecognitionApi(),
  );
  const viewRef = useRef(view);
  const engineChoiceRef = useRef(engineChoice);
  const insertTextRef = useRef(insertText);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const generationRef = useRef(0);
  const pendingPackRef = useRef<PendingPack | null>(null);
  const installCancelRef = useRef<(() => void) | null>(null);
  const installRequestRef = useRef<{ requestId: string; language: string } | null>(null);
  const pendingRequests = useRef(new Map<string, PendingRequest>());
  const whisperSessionRef = useRef<WhisperSession | null>(null);
  const whisperConsentRef = useRef(false);

  viewRef.current = view;
  engineChoiceRef.current = engineChoice;
  insertTextRef.current = insertText;

  const updateView = useCallback((next: DictationView) => {
    viewRef.current = next;
    setView(next);
  }, []);

  useEffect(() => {
    let active = true;
    void storage
      .getItem<unknown>(whisperConsentStorageKey)
      .then((value) => {
        whisperConsentRef.current = value === true;
        if (!active) return;
        updateView({ ...viewRef.current, modelConsentRequired: value !== true });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [updateView]);

  const releaseWhisperSession = (session: WhisperSession) => {
    if (whisperSessionRef.current !== session) return;
    whisperSessionRef.current = null;
    window.clearInterval(session.keepAlive);
    session.rejectReady?.(new Error("Whisper session ended"));
    session.rejectReady = null;
    void session.recorder?.cancel();
    session.recorder = null;
    session.port.disconnect();
  };

  const startWhisper = async (generation: number) => {
    pauseVideo();
    updateView({
      ...emptyView("preparing"),
      engine: "whisper",
      modelConsentRequired: false,
    });
    let port: ExtensionRuntimePort;
    try {
      if (browser.runtime.getManifest().manifest_version === 3) {
        const response: unknown = await browser.runtime.sendMessage({
          type: "frame-notes:ensure-whisper-host",
        });
        if (
          typeof response !== "object" ||
          response === null ||
          Reflect.get(response, "ok") !== true
        ) {
          throw new Error("Whisper offscreen host is unavailable");
        }
      }
      port = browser.runtime.connect({ name: "frame-notes-whisper" });
    } catch {
      updateView({
        ...emptyView("error"),
        engine: "whisper",
        error: "dictationWhisperUnavailable",
      });
      return;
    }
    const session: WhisperSession = {
      port,
      recorder: null,
      keepAlive: window.setInterval(() => {
        try {
          port.postMessage({ type: "keepalive" });
        } catch {
          window.clearInterval(session.keepAlive);
        }
      }, 20_000),
      generation,
      rejectReady: null,
    };
    whisperSessionRef.current = session;
    let ready = false;
    let resolveReady: (() => void) | undefined;
    let rejectReady: ((error: Error) => void) | undefined;
    const readyPromise = new Promise<void>((resolve, reject) => {
      resolveReady = resolve;
      rejectReady = reject;
    });
    session.rejectReady = (error) => rejectReady?.(error);
    const handlePortMessage = (value: unknown) => {
      if (whisperSessionRef.current !== session || typeof value !== "object" || value === null)
        return;
      const type = Reflect.get(value, "type");
      if (type === "progress") {
        const progress = Reflect.get(value, "value");
        updateView({
          ...viewRef.current,
          progress: typeof progress === "number" ? progress : null,
        });
      } else if (type === "ready") {
        const device = Reflect.get(value, "device");
        const dtype = Reflect.get(value, "dtype");
        updateView({
          ...viewRef.current,
          device: device === "webgpu" || device === "wasm" ? device : null,
          dtype: typeof dtype === "string" ? dtype : null,
          progress: null,
        });
        ready = true;
        session.rejectReady = null;
        resolveReady?.();
      } else if (type === "result") {
        const text = Reflect.get(value, "text");
        if (typeof text === "string" && text.trim()) insertTextRef.current(text.trim());
        releaseWhisperSession(session);
        updateView({ ...viewRef.current, phase: "idle", interim: "", progress: null });
      } else if (type === "error") {
        if (!ready) {
          rejectReady?.(new Error("Whisper initialization failed"));
        } else {
          releaseWhisperSession(session);
          updateView({
            ...viewRef.current,
            phase: "error",
            error: "dictationWhisperUnavailable",
            progress: null,
          });
        }
      }
    };
    port.onMessage.addListener(handlePortMessage);
    port.onDisconnect.addListener(() => {
      if (whisperSessionRef.current !== session) return;
      window.clearInterval(session.keepAlive);
      whisperSessionRef.current = null;
      void session.recorder?.cancel();
      session.recorder = null;
      session.rejectReady?.(new Error("Whisper connection closed"));
      session.rejectReady = null;
      if (viewRef.current.phase !== "idle" && viewRef.current.phase !== "error") {
        updateView({ ...viewRef.current, phase: "error", error: "dictationWhisperUnavailable" });
      }
    });
    try {
      port.postMessage({
        type: "prepare",
        consented: whisperConsentRef.current,
        language: locale === "es" ? "spanish" : "english",
      });
      const readyTimer = window.setTimeout(
        () => rejectReady?.(new Error("Whisper initialization timed out")),
        10 * 60 * 1000,
      );
      try {
        await readyPromise;
      } finally {
        window.clearTimeout(readyTimer);
      }
      if (whisperSessionRef.current !== session || generation !== generationRef.current) return;
      const recorder = await startPcmCapture();
      if (whisperSessionRef.current !== session || generation !== generationRef.current) {
        await recorder.cancel();
        return;
      }
      session.recorder = recorder;
      updateView({
        ...viewRef.current,
        phase: "listening",
        engine: "whisper",
        world: null,
        language: locale,
      });
    } catch (error) {
      releaseWhisperSession(session);
      if (generation !== generationRef.current) return;
      const denied = error instanceof DOMException && error.name === "NotAllowedError";
      updateView({
        ...emptyView("error"),
        engine: "whisper",
        error: denied ? "dictationPermission" : "dictationWhisperUnavailable",
      });
    }
  };

  useEffect(() => {
    const receive = (event: SpeechBridgeEvent) => {
      if (event.type === "probe-result" || event.type === "install-result") {
        const pending = pendingRequests.current.get(event.requestId);
        if (pending) {
          clearTimeout(pending.timer);
          pendingRequests.current.delete(event.requestId);
          pending.resolve(event);
        }
        return;
      }
      if (event.sessionId !== sessionIdRef.current) return;
      if (event.type === "started") {
        updateView({ ...viewRef.current, phase: "listening", language: event.language });
      } else if (event.type === "result") {
        if (event.final) insertTextRef.current(event.transcript);
        updateView({
          ...viewRef.current,
          interim: event.final ? "" : event.transcript,
        });
      } else if (event.type === "error") {
        sessionIdRef.current = null;
        updateView({
          ...viewRef.current,
          phase: "error",
          error: errorFromSpeechCode(event.code),
          interim: "",
        });
      } else if (event.type === "ended") {
        sessionIdRef.current = null;
        updateView({ ...viewRef.current, phase: "idle", interim: "" });
      }
    };
    const unsubscribe = bridge.subscribe(receive);
    return () => {
      generationRef.current += 1;
      pendingPackRef.current = null;
      installCancelRef.current?.();
      installCancelRef.current = null;
      const pendingInstall = installRequestRef.current;
      if (pendingInstall)
        cancelMainInstallRequest(
          pendingRequests.current,
          pendingInstall.requestId,
          pendingInstall.language,
        );
      installRequestRef.current = null;
      unsubscribe();
      for (const pending of pendingRequests.current.values()) clearTimeout(pending.timer);
      pendingRequests.current.clear();
      const whisper = whisperSessionRef.current;
      if (whisper) {
        whisperSessionRef.current = null;
        window.clearInterval(whisper.keepAlive);
        try {
          whisper.port.postMessage({ type: "cancel" });
        } catch {
          whisper.port.disconnect();
        }
        void whisper.recorder?.cancel();
        whisper.port.disconnect();
      }
      const sessionId = sessionIdRef.current;
      sessionIdRef.current = null;
      if (sessionId) {
        try {
          bridge.send({ type: "cancel", sessionId });
        } catch {
          sessionIdRef.current = null;
        }
      }
      try {
        recognitionRef.current?.abort();
      } catch {
        recognitionRef.current = null;
      }
      recognitionRef.current = null;
    };
  }, [bridge, updateView]);

  const requestMain = (
    request: Extract<SpeechBridgeRequest, { type: "probe" | "install" }>,
  ): Promise<SpeechBridgeEvent> =>
    new Promise((resolve) => {
      const timer = window.setTimeout(
        () => {
          pendingRequests.current.delete(request.requestId);
          resolve({
            type: "probe-result",
            requestId: request.requestId,
            supported: false,
            availabilities: [],
          });
        },
        request.type === "install" ? 120_000 : 10_000,
      );
      pendingRequests.current.set(request.requestId, { resolve, timer });
      bridge.send(request);
    });

  const fallbackToWhisper = (generation: number) => {
    if (generation !== generationRef.current) return;
    if (engineChoiceRef.current === "chrome-local") {
      updateView({
        ...emptyView("error"),
        apiSupported: viewRef.current.apiSupported,
        probeResults: viewRef.current.probeResults,
        error: "dictationUnsupported",
      });
      return;
    }
    updateView({
      ...emptyView("consent-model"),
      engine: "whisper",
      modelConsentRequired: !whisperConsentRef.current,
      apiSupported: viewRef.current.apiSupported,
      probeResults: viewRef.current.probeResults,
    });
  };

  const startRecognition = (
    language: string,
    world: "isolated" | "main",
    generation: number,
    availability: SpeechAvailability,
    installResult: DictationView["installResult"] = "not-requested",
  ) => {
    if (generation !== generationRef.current) return;
    const sessionId = crypto.randomUUID();
    sessionIdRef.current = sessionId;
    pauseVideo();
    updateView({
      phase: "preparing",
      engine: "chrome-local",
      world,
      language,
      availability,
      installResult,
      interim: "",
      progress: null,
      error: null,
      modelConsentRequired: false,
      device: null,
      dtype: null,
      apiSupported: viewRef.current.apiSupported,
      probeResults: viewRef.current.probeResults,
    });
    if (world === "main") {
      bridge.send({ type: "start", sessionId, language });
      return;
    }
    if (!isolatedApi) {
      updateView({ ...viewRef.current, phase: "error", error: "dictationUnsupported" });
      return;
    }
    try {
      recognitionRef.current = startLocalRecognition(isolatedApi, language, {
        onResult: (transcript, final) => {
          if (sessionIdRef.current !== sessionId) return;
          if (final) insertTextRef.current(transcript);
          updateView({ ...viewRef.current, interim: final ? "" : transcript });
        },
        onError: (code) => {
          if (sessionIdRef.current !== sessionId) return;
          sessionIdRef.current = null;
          recognitionRef.current = null;
          updateView({
            ...viewRef.current,
            phase: "error",
            error: errorFromSpeechCode(code),
            interim: "",
          });
        },
        onEnd: () => {
          if (sessionIdRef.current !== sessionId) return;
          sessionIdRef.current = null;
          recognitionRef.current = null;
          updateView({ ...viewRef.current, phase: "idle", interim: "" });
        },
      });
      updateView({ ...viewRef.current, phase: "listening" });
    } catch {
      sessionIdRef.current = null;
      recognitionRef.current = null;
      updateView({ ...viewRef.current, phase: "error", error: "dictationFailed" });
    }
  };

  const start = () => {
    if (
      viewRef.current.phase === "preparing" ||
      viewRef.current.phase === "listening" ||
      viewRef.current.phase === "transcribing"
    ) {
      return;
    }
    const generation = ++generationRef.current;
    pauseVideo();
    updateView(emptyView("preparing"));
    if (engineChoiceRef.current === "whisper") {
      if (whisperConsentRef.current) {
        void startWhisper(generation);
      } else {
        updateView({
          ...emptyView("consent-model"),
          engine: "whisper",
          modelConsentRequired: true,
        });
      }
      return;
    }

    const languages = [...speechLanguageCandidates(locale, [...navigator.languages])];
    const world = isolatedApi ? "isolated" : "main";
    const probe = isolatedApi
      ? checkSpeechLanguages(isolatedApi, languages).then((availabilities) => ({
          supported: true,
          availabilities,
        }))
      : requestMain({
          type: "probe",
          requestId: crypto.randomUUID(),
          languages,
        }).then((event) => ({
          supported: event.type === "probe-result" && event.supported,
          availabilities: event.type === "probe-result" ? event.availabilities : [],
        }));

    void probe
      .then(({ supported, availabilities }) => {
        if (generation !== generationRef.current) return;
        updateView({
          ...viewRef.current,
          world,
          apiSupported: supported,
          probeResults: availabilities,
        });
        const result = supported ? chooseLanguage(availabilities) : null;
        const engine = selectDictationEngine(engineChoiceRef.current, result !== null);
        if (engine === "whisper") {
          fallbackToWhisper(generation);
          return;
        }
        if (engine === "unsupported") {
          updateView({
            ...emptyView("error"),
            world,
            apiSupported: supported,
            probeResults: availabilities,
            error: "dictationUnsupported",
          });
          return;
        }
        if (result?.availability === "available") {
          startRecognition(result.language, world, generation, result.availability);
          return;
        }
        if (result) {
          pendingPackRef.current = { language: result.language, world, generation };
          updateView({
            ...emptyView("consent-language"),
            engine: "chrome-local",
            world,
            language: result.language,
            availability: result.availability,
            apiSupported: supported,
            probeResults: availabilities,
          });
          return;
        }
        fallbackToWhisper(generation);
      })
      .catch(() => fallbackToWhisper(generation));
  };

  const installLanguagePack = () => {
    const pending = pendingPackRef.current;
    if (!pending || pending.generation !== generationRef.current) return;
    updateView({
      ...viewRef.current,
      phase: "preparing",
      installResult: "not-requested",
      error: null,
    });
    const requestId = crypto.randomUUID();
    const install =
      pending.world === "isolated" && isolatedApi
        ? isolatedApi
            .install({ langs: [pending.language], processLocally: true })
            .then((installed) => ({
              type: "install-result" as const,
              requestId,
              language: pending.language,
              installed,
            }))
        : requestMain({ type: "install", requestId, language: pending.language }).then((event) =>
            event.type === "install-result"
              ? event
              : {
                  type: "install-result" as const,
                  requestId,
                  language: pending.language,
                  installed: false,
                },
          );
    if (pending.world === "main")
      installRequestRef.current = { requestId, language: pending.language };

    let timeoutId = 0;
    let resolveCancelled: ((outcome: PackInstallOutcome) => void) | null = null;
    const timeout = new Promise<PackInstallOutcome>((resolve) => {
      timeoutId = window.setTimeout(() => resolve({ kind: "timeout" }), 120_000);
    });
    const cancelled = new Promise<PackInstallOutcome>((resolve) => {
      resolveCancelled = resolve;
    });
    const cancelInstall = () => resolveCancelled?.({ kind: "cancelled" });
    installCancelRef.current = cancelInstall;

    void Promise.race([
      install.then(
        (event): PackInstallOutcome => ({
          kind: "finished",
          installed: event.type === "install-result" && event.installed,
        }),
        (): PackInstallOutcome => ({ kind: "finished", installed: false }),
      ),
      timeout,
      cancelled,
    ]).then((outcome) => {
      window.clearTimeout(timeoutId);
      if (installCancelRef.current === cancelInstall) installCancelRef.current = null;
      if (installRequestRef.current?.requestId === requestId) {
        cancelMainInstallRequest(pendingRequests.current, requestId, pending.language);
        installRequestRef.current = null;
      }
      if (outcome.kind === "cancelled" || pending.generation !== generationRef.current) return;

      const installed = outcome.kind === "finished" && outcome.installed;
      if (!installed) {
        pendingPackRef.current = null;
        updateView({
          ...viewRef.current,
          phase: "error",
          installResult: "failed",
          error: "dictationPackFailed",
        });
        return;
      }

      pendingPackRef.current = null;
      updateView({
        ...viewRef.current,
        phase: "preparing",
        installResult: "installed",
        availability: "available",
        error: null,
      });
      startRecognition(
        pending.language,
        pending.world,
        pending.generation,
        "available",
        "installed",
      );
    });
  };

  const cancelLanguagePack = () => {
    const pending = pendingPackRef.current;
    if (
      !pending ||
      viewRef.current.phase !== "preparing" ||
      !viewRef.current.engine ||
      viewRef.current.installResult !== "not-requested"
    )
      return;
    generationRef.current += 1;
    pendingPackRef.current = null;
    installCancelRef.current?.();
    installCancelRef.current = null;
    const pendingInstall = installRequestRef.current;
    if (pendingInstall)
      cancelMainInstallRequest(
        pendingRequests.current,
        pendingInstall.requestId,
        pendingInstall.language,
      );
    installRequestRef.current = null;
    updateView(emptyView());
  };

  const stop = () => {
    if (viewRef.current.phase === "transcribing") {
      cancel();
      return;
    }
    const whisper = whisperSessionRef.current;
    if (viewRef.current.engine === "whisper" && whisper) {
      if (!whisper.recorder) {
        cancel();
        return;
      }
      updateView({ ...viewRef.current, phase: "transcribing" });
      void whisper.recorder
        .stop()
        .then((samples) => {
          if (whisperSessionRef.current !== whisper) return;
          for (const chunk of chunkPcm(samples)) {
            whisper.port.postMessage({ type: "pcm", samples: chunk });
          }
          whisper.port.postMessage({ type: "finish" });
        })
        .catch(() => {
          releaseWhisperSession(whisper);
          updateView({
            ...viewRef.current,
            phase: "error",
            error: "dictationWhisperUnavailable",
          });
        });
      return;
    }
    const sessionId = sessionIdRef.current;
    if (!sessionId) {
      if (viewRef.current.phase === "preparing") {
        generationRef.current += 1;
        updateView(emptyView());
      }
      return;
    }
    updateView({ ...viewRef.current, phase: "transcribing" });
    try {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      } else {
        bridge.send({ type: "stop", sessionId });
      }
    } catch {
      cancel();
    }
  };

  function cancel() {
    generationRef.current += 1;
    pendingPackRef.current = null;
    const sessionId = sessionIdRef.current;
    sessionIdRef.current = null;
    const whisper = whisperSessionRef.current;
    if (whisper) {
      try {
        whisper.port.postMessage({ type: "cancel" });
      } catch {
        whisper.port.disconnect();
      }
      releaseWhisperSession(whisper);
    }
    try {
      recognitionRef.current?.abort();
    } catch {
      recognitionRef.current = null;
    }
    recognitionRef.current = null;
    if (sessionId) {
      try {
        bridge.send({ type: "cancel", sessionId });
      } catch {
        sessionIdRef.current = null;
      }
    }
    updateView(emptyView());
  }

  const consentToWhisper = () => {
    whisperConsentRef.current = true;
    void storage.setItem(whisperConsentStorageKey, true).catch(() => undefined);
    void startWhisper(generationRef.current);
  };

  const switchToWhisper = () => {
    const generation = ++generationRef.current;
    pendingPackRef.current = null;
    if (whisperConsentRef.current) {
      void startWhisper(generation);
      return;
    }
    updateView({
      ...emptyView("consent-model"),
      engine: "whisper",
      modelConsentRequired: true,
      apiSupported: viewRef.current.apiSupported,
      probeResults: viewRef.current.probeResults,
    });
  };

  return {
    view,
    isActive:
      view.phase === "preparing" || view.phase === "listening" || view.phase === "transcribing",
    start,
    stop,
    cancel,
    installLanguagePack,
    cancelLanguagePack,
    consentToWhisper,
    switchToWhisper,
  };
}
