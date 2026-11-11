import { Film, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import {
  type DragEvent as ReactDragEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createRoot } from "react-dom/client";
import { storage } from "wxt/utils/storage";
import contentCss from "../../src/content.css?inline";
import { createSpeechCommandHandler } from "../../src/dictation/local-speech";
import type {
  SpeechBridge,
  SpeechBridgeEvent,
  SpeechBridgeRequest,
} from "../../src/dictation/protocol";
import { currentLocale, startLocalePreferenceWatch, t } from "../../src/i18n";
import {
  copyText,
  emptyNotesDoc,
  formatTime,
  framesAt,
  notesJson,
  notesMarkdown,
} from "../../src/model";
import { NotePanel, type PanelAction, type PanelActionRef } from "../../src/panel";
import { type ReviewExportExtension, reviewExportName } from "../../src/review/export-name";
import { estimateFps, REVIEW_FRAME_RATES } from "../../src/review/fps";
import { ReviewTimeline } from "../../src/review/review-timeline";
import { createVideoPlayerAdapter, type VideoPlayerAdapter } from "../../src/review/video-player";
import { NoteSession, type SessionState } from "../../src/session";
import { handlePanelKeyboardEvent } from "../../src/shortcuts";
import { nudgeFrames } from "../../src/timeline-math";
import { useLocale } from "../../src/use-locale";

const namespace = "frame-notes:v1";
const emptySessionState: SessionState = {
  currentTime: 0,
  duration: 0,
  paused: true,
  fps: 30,
  loopingRange: null,
  doc: emptyNotesDoc(""),
  syncStatus: "loading",
};

function subscribeEmpty(): () => void {
  return () => undefined;
}

function getEmptySessionState(): SessionState {
  return emptySessionState;
}

function useSessionState(session: NoteSession | null): SessionState {
  return useSyncExternalStore(
    session?.subscribe ?? subscribeEmpty,
    session?.getSnapshot ?? getEmptySessionState,
    session?.getSnapshot ?? getEmptySessionState,
  );
}

function downloadText(fileName: string, content: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function isPanelAction(value: unknown): value is PanelAction {
  return (
    value === "new" ||
    value === "start" ||
    value === "end" ||
    value === "copy" ||
    value === "minimize"
  );
}

function isEditableTarget(target: EventTarget | undefined): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  );
}

function ReviewPage() {
  const locale = useLocale();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const panelHostRef = useRef<HTMLElement | null>(null);
  const actionRef = useRef<PanelActionRef>({ current: null });
  const sessionRef = useRef<NoteSession | null>(null);
  const adapterRef = useRef<VideoPlayerAdapter | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const manualFpsRef = useRef<number | null>(null);
  const fpsStorageKeyRef = useRef<`local:${string}` | null>(null);
  const frameDeltasRef = useRef<number[]>([]);
  const loadGenerationRef = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [session, setSession] = useState<NoteSession | null>(null);
  const [autoFps, setAutoFps] = useState(30);
  const [manualFps, setManualFps] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [tabId, setTabId] = useState<number | null>(null);
  const sessionState = useSessionState(session);
  const fps = manualFps ?? autoFps;
  const fpsRef = useRef(fps);
  fpsRef.current = fps;
  const shortcutStateRef = useRef({ session, file, sessionState, fps });
  shortcutStateRef.current = { session, file, sessionState, fps };

  const speechBridge = useMemo<SpeechBridge>(() => {
    const listeners = new Set<(event: SpeechBridgeEvent) => void>();
    const handleSpeechCommand = createSpeechCommandHandler(window, (event) => {
      for (const listener of listeners) listener(event);
    });
    return {
      send(request: SpeechBridgeRequest) {
        void handleSpeechCommand(request);
      },
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
  }, []);

  useEffect(() => {
    startLocalePreferenceWatch();
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = `${t("reviewTitle", locale)} · ${t("appName", locale)}`;
    void session?.setLocale(locale);
  }, [locale, session]);

  useEffect(() => {
    void browser.tabs.getCurrent().then((tab) => {
      if (tab?.id !== undefined) setTabId(tab.id);
    });
  }, []);

  useEffect(() => {
    const listener: Parameters<typeof browser.runtime.onMessage.addListener>[0] = (
      message,
      _sender,
      sendResponse,
    ) => {
      if (
        typeof message !== "object" ||
        message === null ||
        Reflect.get(message, "namespace") !== namespace ||
        Reflect.get(message, "type") !== "shortcut" ||
        Reflect.get(message, "tabId") !== tabId ||
        !isPanelAction(Reflect.get(message, "action"))
      ) {
        return false;
      }
      actionRef.current.current?.(Reflect.get(message, "action"));
      sendResponse({ ok: true });
      return true;
    };
    browser.runtime.onMessage.addListener(listener);
    return () => browser.runtime.onMessage.removeListener(listener);
  }, [tabId]);

  useEffect(() => {
    if (!session) return;
    const host = document.createElement("div");
    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = contentCss;
    const container = document.createElement("div");
    shadow.append(style, container);
    document.body.append(host);
    panelHostRef.current = host;
    const root = createRoot(container);
    root.render(
      <NotePanel
        session={session}
        project={file?.name ?? session.project}
        actionRef={actionRef.current}
        speechBridge={speechBridge}
        storageKey={`${session.storageKey}:panel`}
        notesTarget="download"
      />,
    );
    return () => {
      panelHostRef.current = null;
      actionRef.current.current = null;
      root.unmount();
      host.remove();
    };
  }, [file, session, speechBridge]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !session) return;
    const adapter = createVideoPlayerAdapter(
      video,
      session,
      () => fpsRef.current,
      (delta) => {
        const samples = [...frameDeltasRef.current, delta].slice(-180);
        frameDeltasRef.current = samples;
        const estimate = estimateFps(samples);
        if (estimate !== null && manualFpsRef.current === null) setAutoFps(estimate);
      },
    );
    adapterRef.current = adapter;
    return () => {
      adapter.dispose();
      if (adapterRef.current === adapter) adapterRef.current = null;
    };
  }, [session]);

  useEffect(() => {
    if (fps > 0) adapterRef.current?.refresh();
  }, [fps]);

  useEffect(
    () => () => {
      adapterRef.current?.dispose();
      sessionRef.current?.dispose();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    [],
  );

  const loadVideo = (nextFile: File) => {
    if (nextFile.type && !nextFile.type.startsWith("video/")) {
      setError(t("reviewInvalidVideo", locale));
      return;
    }
    adapterRef.current?.dispose();
    adapterRef.current = null;
    sessionRef.current?.dispose();
    const oldUrl = objectUrlRef.current;
    if (oldUrl) URL.revokeObjectURL(oldUrl);
    const nextUrl = URL.createObjectURL(nextFile);
    objectUrlRef.current = nextUrl;
    setVideoUrl(nextUrl);
    setFile(nextFile);
    setError("");
    setFeedback("");
    setAutoFps(30);
    setManualFps(null);
    manualFpsRef.current = null;
    frameDeltasRef.current = [];
    const generation = ++loadGenerationRef.current;
    const origin = `local-video:${nextFile.size}:${nextFile.lastModified}`;
    const storageKey = `local:frame-notes:review-fps:${origin}` as `local:${string}`;
    fpsStorageKeyRef.current = storageKey;
    const nextSession = new NoteSession(
      nextFile.name,
      origin,
      (command, value) => adapterRef.current?.command(command, value),
      currentLocale(),
      { projectFiles: false },
    );
    sessionRef.current = nextSession;
    setSession(nextSession);
    void nextSession.load().then(() => {
      if (generation !== loadGenerationRef.current || manualFpsRef.current !== null) return;
      const savedFps = nextSession.getDocumentSnapshot().fps;
      if (!Number.isFinite(savedFps) || savedFps <= 0) return;
      setAutoFps(savedFps);
      fpsRef.current = savedFps;
      adapterRef.current?.refresh();
    });
    void storage
      .getItem<unknown>(storageKey)
      .then((saved) => {
        if (
          generation === loadGenerationRef.current &&
          typeof saved === "number" &&
          REVIEW_FRAME_RATES.some((rate) => rate === saved)
        ) {
          manualFpsRef.current = saved;
          setManualFps(saved);
        }
      })
      .catch(() => undefined);
  };

  const chooseFiles = (files: FileList | null) => {
    const nextFile = files?.[0];
    if (nextFile) loadVideo(nextFile);
  };

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => setError(t("reviewUnsupportedCodec", locale)));
    else session?.command("pause");
  };

  const seek = (time: number) => session?.command("seek", time);

  const chooseFrameRate = (value: string) => {
    const next = value === "auto" ? null : Number(value);
    if (next !== null && !REVIEW_FRAME_RATES.some((rate) => rate === next)) return;
    manualFpsRef.current = next;
    setManualFps(next);
    adapterRef.current?.refresh();
    const key = fpsStorageKeyRef.current;
    if (!key) return;
    if (next === null) void browser.storage.local.remove(key).catch(() => undefined);
    else void storage.setItem(key, next).catch(() => undefined);
  };

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(copyText(sessionState.doc, locale));
      setFeedback(t("copied", locale));
    } catch {
      setFeedback(t("copyFailed", locale));
    }
  };

  const exportNotes = (extension: ReviewExportExtension) => {
    if (!file) return;
    const content =
      extension === "md" ? notesMarkdown(sessionState.doc, locale) : notesJson(sessionState.doc);
    const mimeType = extension === "md" ? "text/markdown" : "application/json";
    downloadText(reviewExportName(file.name, extension), content, mimeType);
  };

  useEffect(() => {
    const onPageKeyDown = (event: KeyboardEvent) => {
      if (handlePanelKeyboardEvent(event, actionRef.current, panelHostRef.current)) return;
      const current = shortcutStateRef.current;
      if (
        event.type !== "keydown" ||
        !current.session ||
        !current.file ||
        current.sessionState.duration <= 0
      ) {
        return;
      }
      const target = event.composedPath()[0];
      if (
        isEditableTarget(target) ||
        document.querySelector('[role="dialog"], [aria-modal="true"]') ||
        panelHostRef.current?.shadowRoot?.querySelector('[role="dialog"], [aria-modal="true"]')
      ) {
        return;
      }
      if (event.code === "Space") {
        event.preventDefault();
        const video = videoRef.current;
        if (video?.paused) void video.play().catch(() => undefined);
        else current.session.command("pause");
      } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const direction = event.key === "ArrowLeft" ? -1 : 1;
        const nextTime = event.shiftKey
          ? current.sessionState.currentTime + direction
          : nudgeFrames(
              current.sessionState.currentTime,
              direction,
              current.fps,
              current.sessionState.duration,
            );
        current.session.command(
          "seek",
          Math.min(Math.max(nextTime, 0), current.sessionState.duration),
        );
      }
    };
    window.addEventListener("keydown", onPageKeyDown, true);
    window.addEventListener("keyup", onPageKeyDown, true);
    window.addEventListener("keypress", onPageKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onPageKeyDown, true);
      window.removeEventListener("keyup", onPageKeyDown, true);
      window.removeEventListener("keypress", onPageKeyDown, true);
    };
  }, []);

  const fpsLabel = Number.isInteger(autoFps) ? String(autoFps) : String(Number(autoFps.toFixed(2)));
  const handleDrop = (event: ReactDragEvent<HTMLElement>) => {
    event.preventDefault();
    setDragActive(false);
    chooseFiles(event.dataTransfer.files);
  };

  return (
    <main
      className={`review-page${dragActive ? " review-page--dragging" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragActive(false);
      }}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        className="review-file-input"
        type="file"
        accept="video/*"
        onChange={(event) => {
          chooseFiles(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
      />
      <header className="review-header">
        <div className="review-brand">
          <span className="review-brand-mark" aria-hidden="true">
            <Film size={20} />
          </span>
          <div>
            <strong>{t("appName", locale)}</strong>
            {file ? (
              <span title={file.name}>{file.name}</span>
            ) : (
              <span>{t("reviewTitle", locale)}</span>
            )}
          </div>
        </div>
        {file ? (
          <div className="review-header-actions">
            <button type="button" onClick={() => void copyAll()}>
              {t("copyAll", locale)}
            </button>
            <button type="button" onClick={() => exportNotes("md")}>
              {t("reviewDownloadMarkdown", locale)}
            </button>
            <button type="button" onClick={() => exportNotes("json")}>
              {t("reviewDownloadJson", locale)}
            </button>
            <button
              type="button"
              className="review-secondary"
              onClick={() => inputRef.current?.click()}
            >
              {t("reviewChangeVideo", locale)}
            </button>
          </div>
        ) : null}
      </header>

      {file && videoUrl ? (
        <div className="review-workspace">
          <section className="review-video-shell" aria-label={file.name}>
            {/* biome-ignore lint/a11y/useMediaCaption: Local video files may not include captions. */}
            <video
              key={videoUrl}
              ref={videoRef}
              className="review-video"
              aria-label={file.name}
              src={videoUrl}
              playsInline
              preload="metadata"
              onError={() => {
                if (videoUrl === objectUrlRef.current)
                  setError(t("reviewUnsupportedCodec", locale));
              }}
            />
            {error && (
              <div className="review-video-error" role="alert">
                {error}
              </div>
            )}
          </section>

          <section className="review-transport" aria-label={t("reviewTransport", locale)}>
            <div className="review-transport-buttons">
              <button
                type="button"
                aria-label={t("reviewFrameBack", locale)}
                title={t("reviewFrameBack", locale)}
                disabled={sessionState.duration <= 0}
                onClick={() =>
                  seek(nudgeFrames(sessionState.currentTime, -1, fps, sessionState.duration))
                }
              >
                <SkipBack size={17} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="review-play-button"
                aria-label={
                  sessionState.paused ? t("reviewPlay", locale) : t("reviewPause", locale)
                }
                title={sessionState.paused ? t("reviewPlay", locale) : t("reviewPause", locale)}
                onClick={togglePlayback}
              >
                {sessionState.paused ? (
                  <Play size={18} fill="currentColor" aria-hidden="true" />
                ) : (
                  <Pause size={18} fill="currentColor" aria-hidden="true" />
                )}
              </button>
              <button
                type="button"
                aria-label={t("reviewFrameForward", locale)}
                title={t("reviewFrameForward", locale)}
                disabled={sessionState.duration <= 0}
                onClick={() =>
                  seek(nudgeFrames(sessionState.currentTime, 1, fps, sessionState.duration))
                }
              >
                <SkipForward size={17} aria-hidden="true" />
              </button>
            </div>
            <div className="review-time-readout">
              <strong>{formatTime(sessionState.currentTime)}</strong>
              <span>/ {formatTime(sessionState.duration)}</span>
              <span>· f{framesAt(sessionState.currentTime, fps)}</span>
              {sessionState.loopingRange && (
                <span className="review-loop-indicator" title={t("reviewLooping", locale)}>
                  {t("reviewLooping", locale)}
                </span>
              )}
            </div>
            <label className="review-fps-select">
              <span>{t("reviewFps", locale)}</span>
              <select
                value={manualFps === null ? "auto" : String(manualFps)}
                onChange={(event) => chooseFrameRate(event.currentTarget.value)}
              >
                <option value="auto">
                  {t("reviewAutoFps", locale).replace("{fps}", fpsLabel)}
                </option>
                {REVIEW_FRAME_RATES.map((rate) => (
                  <option value={rate} key={rate}>
                    {t("reviewFpsValue", locale).replace("{fps}", String(rate))}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <ReviewTimeline
            notes={sessionState.doc.notes}
            currentTime={sessionState.currentTime}
            duration={sessionState.duration}
            paused={sessionState.paused}
            onSeek={seek}
            onPause={() => session?.command("pause")}
            onPlay={() => void videoRef.current?.play().catch(() => undefined)}
          />
          <p className="review-export-hint">{t("reviewSaveHint", locale)}</p>
          {feedback && (
            <p className="review-feedback" role="status">
              {feedback}
            </p>
          )}
        </div>
      ) : (
        <section className="review-empty">
          <div className="review-empty-card">
            <span className="review-empty-icon" aria-hidden="true">
              <Film size={30} />
            </span>
            <h1>{t("reviewEmptyTitle", locale)}</h1>
            <p>{t("reviewEmptyBody", locale)}</p>
            <button type="button" onClick={() => inputRef.current?.click()}>
              {t("reviewChooseVideo", locale)}
            </button>
            <span className="review-drop-prompt">{t("reviewDropPrompt", locale)}</span>
            {error && (
              <p className="review-error-message" role="alert">
                {error}
              </p>
            )}
          </div>
        </section>
      )}
    </main>
  );
}

const rootElement = document.querySelector<HTMLDivElement>("#review-root");
if (rootElement) createRoot(rootElement).render(<ReviewPage />);
