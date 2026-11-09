import { ZoomIn, ZoomOut } from "lucide-react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { storage } from "wxt/utils/storage";
import { t } from "./i18n";
import { formatTime, type Note, sortNotes } from "./model";
import type { NoteSession } from "./session";
import { detailWindow, type TimeWindow, timeToX, xToTime } from "./timeline-math";
import { useLocale } from "./use-locale";

const windowWidths = [1, 2, 4, 8, 15, 30];
const windowWidthStorageKey: `local:${string}` = "local:frame-notes:detail-window-width";

interface DetailStripProps {
  session: NoteSession;
  notes: Note[];
  fps: number;
  editorStart: number | null;
  editorEnd: number | null;
}

export function DetailStrip({ session, notes, fps, editorStart, editorEnd }: DetailStripProps) {
  const currentTime = useSyncExternalStore(
    session.subscribeCurrentTime,
    session.getCurrentTimeSnapshot,
    session.getCurrentTimeSnapshot,
  );
  const duration = useSyncExternalStore(
    session.subscribeDuration,
    session.getDurationSnapshot,
    session.getDurationSnapshot,
  );
  const [width, setWidth] = useState(4);
  const [scrubCenter, setScrubCenter] = useState<number | null>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragWindow = useRef<TimeWindow | null>(null);
  const draggingPointer = useRef<number | null>(null);
  const locale = useLocale();
  const draftCenter =
    editorStart === null ? null : editorEnd === null ? editorStart : (editorStart + editorEnd) / 2;
  const visibleWindow = detailWindow(scrubCenter ?? draftCenter ?? currentTime, width, duration);

  useEffect(() => {
    let active = true;
    void storage
      .getItem<number>(windowWidthStorageKey)
      .then((saved) => {
        if (active && typeof saved === "number" && windowWidths.includes(saved)) setWidth(saved);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (draftCenter === null) setScrubCenter(null);
  }, [draftCenter]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const observer = new ResizeObserver(() => {
      const nextWidth = track.getBoundingClientRect().width;
      setTrackWidth((previous) => (previous === nextWidth ? previous : nextWidth));
    });
    observer.observe(track);
    return () => observer.disconnect();
  }, []);

  const changeWidth = (direction: -1 | 1) => {
    const currentIndex = windowWidths.indexOf(width);
    const nextIndex = Math.min(Math.max(currentIndex + direction, 0), windowWidths.length - 1);
    const nextWidth = windowWidths[nextIndex] ?? width;
    setWidth(nextWidth);
    void storage.setItem(windowWidthStorageKey, nextWidth).catch(() => undefined);
  };

  const seekAtPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = trackRef.current?.getBoundingClientRect();
    const window = dragWindow.current ?? visibleWindow;
    if (!rect || rect.width <= 0 || duration <= 0) return;
    const time = xToTime(event.clientX, rect.left, rect.width, window);
    if (draftCenter !== null) setScrubCenter(time);
    session.command("seek", time);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || duration <= 0) return;
    event.preventDefault();
    draggingPointer.current = event.pointerId;
    dragWindow.current = visibleWindow;
    event.currentTarget.setPointerCapture(event.pointerId);
    seekAtPointer(event);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (draggingPointer.current === event.pointerId) seekAtPointer(event);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (draggingPointer.current !== event.pointerId) return;
    draggingPointer.current = null;
    dragWindow.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const secondStep =
    trackWidth > 0 && visibleWindow.end > visibleWindow.start
      ? Math.max(1, Math.ceil((46 * (visibleWindow.end - visibleWindow.start)) / trackWidth))
      : 1;
  const frameSpacing =
    fps > 0 && visibleWindow.end > visibleWindow.start
      ? trackWidth / ((visibleWindow.end - visibleWindow.start) * fps)
      : 0;
  const firstSecond = Math.ceil(visibleWindow.start);
  const lastSecond = Math.floor(visibleWindow.end);
  const firstFrame = Math.ceil(visibleWindow.start * fps);
  const lastFrame = Math.floor(visibleWindow.end * fps);
  const visibleNotes = sortNotes(notes).filter((note) => {
    const end = note.end ?? note.start;
    return note.start <= visibleWindow.end && end >= visibleWindow.start;
  });
  const draftLeft =
    editorStart === null ? null : timeToX(editorStart, 0, trackWidth, visibleWindow);
  const draftRight =
    editorStart === null || editorEnd === null
      ? draftLeft
      : timeToX(editorEnd, 0, trackWidth, visibleWindow);
  const playheadLeft = timeToX(currentTime, 0, trackWidth, visibleWindow);

  return (
    <section className="fn-detail" aria-label={t("detailStrip", locale)}>
      <div className="fn-detail-header">
        <strong>{t("detailStrip", locale)}</strong>
        <div className="fn-detail-controls">
          <button
            type="button"
            onClick={() => changeWidth(-1)}
            disabled={widthWidthsAt(width) === 0}
            aria-label={t("narrowDetail", locale)}
            title={t("narrowDetail", locale)}
          >
            <ZoomOut size={14} strokeWidth={2} aria-hidden="true" focusable="false" />
          </button>
          <span>{width}s</span>
          <button
            type="button"
            onClick={() => changeWidth(1)}
            disabled={widthWidthsAt(width) === windowWidths.length - 1}
            aria-label={t("widenDetail", locale)}
            title={t("widenDetail", locale)}
          >
            <ZoomIn size={14} strokeWidth={2} aria-hidden="true" focusable="false" />
          </button>
        </div>
      </div>
      <div
        ref={trackRef}
        className="fn-detail-track"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {trackWidth > 0 &&
          visibleWindow.end > visibleWindow.start &&
          Array.from({ length: Math.max(0, lastSecond - firstSecond + 1) }, (_, index) => {
            const second = firstSecond + index;
            const left = timeToX(second, 0, trackWidth, visibleWindow);
            const showLabel = second % secondStep === 0;
            return (
              <div className="fn-detail-second" key={`second-${second}`} style={{ left }}>
                {showLabel && <span>{formatTime(second)}</span>}
              </div>
            );
          })}
        {trackWidth > 0 &&
          frameSpacing >= 4 &&
          Array.from({ length: Math.max(0, lastFrame - firstFrame + 1) }, (_, index) => {
            const frame = firstFrame + index;
            return (
              <div
                className="fn-detail-frame"
                key={`frame-${frame}`}
                style={{ left: timeToX(frame / fps, 0, trackWidth, visibleWindow) }}
              />
            );
          })}
        {draftLeft !== null && draftRight !== null && (
          <div
            className="fn-detail-draft"
            style={{
              left: Math.min(draftLeft, draftRight),
              width: Math.max(2, Math.abs(draftRight - draftLeft)),
            }}
          />
        )}
        {visibleNotes.map((note, index) => {
          const left = timeToX(note.start, 0, trackWidth, visibleWindow);
          const end = note.end ?? note.start;
          const right = timeToX(end, 0, trackWidth, visibleWindow);
          return (
            <div
              className={`fn-detail-note${note.end === null ? " fn-detail-note--point" : ""}`}
              key={note.id}
              title={`${formatTime(note.start)}${note.end === null ? "" : `–${formatTime(note.end)}`}: ${note.text}`}
              style={{
                left: Math.min(left, right),
                width: Math.max(2, right - left),
                top: 24 + (index % 3) * 7,
              }}
            />
          );
        })}
        <div className="fn-detail-playhead" style={{ left: playheadLeft }} />
      </div>
    </section>
  );
}

function widthWidthsAt(width: number): number {
  return windowWidths.indexOf(width);
}
