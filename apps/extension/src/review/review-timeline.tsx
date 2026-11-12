import { Minus, Plus } from "lucide-react";
import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { t } from "../i18n";
import { formatTime, type Note } from "../model";
import { timeToX, xToTime } from "../timeline-math";
import { useLocale } from "../use-locale";
import {
  clampTimelineZoom,
  reviewPixelsPerSecond,
  reviewTimelineWidth,
  timelineTickInterval,
  visibleTimelineWindow,
} from "./timeline-math";

interface ReviewTimelineProps {
  notes: Note[];
  currentTime: number;
  duration: number;
  paused: boolean;
  onSeek: (time: number) => void;
  onPause: () => void;
  onPlay: () => void;
}

interface ZoomAnchor {
  time: number;
  x: number;
}

export function ReviewTimeline({
  notes,
  currentTime,
  duration,
  paused,
  onSeek,
  onPause,
  onPlay,
}: ReviewTimelineProps) {
  const locale = useLocale();
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const zoomAnchorRef = useRef<ZoomAnchor | null>(null);
  const scrubRef = useRef<{ pointerId: number; wasPaused: boolean } | null>(null);
  const interactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userInteractingRef = useRef(false);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [zoom, setZoom] = useState(1);

  const pixelsPerSecond = reviewPixelsPerSecond(viewportWidth, duration, zoom);
  const trackWidth = reviewTimelineWidth(viewportWidth, duration, zoom);
  const window = visibleTimelineWindow(scrollLeft, viewportWidth, pixelsPerSecond, duration);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(() => setViewportWidth(viewport.clientWidth));
    observer.observe(viewport);
    setViewportWidth(viewport.clientWidth);
    return () => observer.disconnect();
  }, []);

  useEffect(
    () => () => {
      if (interactionTimerRef.current) clearTimeout(interactionTimerRef.current);
    },
    [],
  );

  useLayoutEffect(() => {
    const anchor = zoomAnchorRef.current;
    const viewport = viewportRef.current;
    if (!anchor || !viewport || pixelsPerSecond <= 0) return;
    viewport.scrollLeft = Math.max(0, anchor.time * pixelsPerSecond - anchor.x);
    zoomAnchorRef.current = null;
  }, [pixelsPerSecond]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || paused || duration <= 0 || pixelsPerSecond <= 0 || userInteractingRef.current)
      return;
    const visible = visibleTimelineWindow(
      viewport.scrollLeft,
      viewport.clientWidth,
      pixelsPerSecond,
      duration,
    );
    if (currentTime < visible.start || currentTime > visible.end) {
      viewport.scrollLeft = Math.max(0, currentTime * pixelsPerSecond - viewport.clientWidth / 2);
    }
  }, [currentTime, duration, paused, pixelsPerSecond]);

  const markUserInteraction = useCallback(() => {
    userInteractingRef.current = true;
    if (interactionTimerRef.current) clearTimeout(interactionTimerRef.current);
    interactionTimerRef.current = setTimeout(() => {
      userInteractingRef.current = false;
    }, 900);
  }, []);

  const zoomAround = useCallback(
    (nextZoom: number, anchorX: number) => {
      if (pixelsPerSecond <= 0 || !viewportRef.current) return;
      markUserInteraction();
      const time = (viewportRef.current.scrollLeft + anchorX) / pixelsPerSecond;
      zoomAnchorRef.current = { time, x: anchorX };
      setZoom(clampTimelineZoom(nextZoom, duration));
    },
    [duration, markUserInteraction, pixelsPerSecond],
  );

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      markUserInteraction();
      if (event.ctrlKey || event.metaKey) {
        const anchorX = event.clientX - viewport.getBoundingClientRect().left;
        zoomAround(zoom * (event.deltaY < 0 ? 1.25 : 0.8), anchorX);
      } else {
        viewport.scrollLeft +=
          Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      }
    };
    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", handleWheel);
  }, [markUserInteraction, zoom, zoomAround]);

  const changeZoom = (direction: -1 | 1) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const playheadX = Math.min(
      Math.max(currentTime * pixelsPerSecond - viewport.scrollLeft, 0),
      viewport.clientWidth,
    );
    zoomAround(zoom * (direction > 0 ? 1.5 : 1 / 1.5), playheadX);
  };

  const fitTimeline = () => {
    zoomAnchorRef.current = { time: 0, x: 0 };
    setZoom(1);
    markUserInteraction();
  };

  const seekAtPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    if (!track || duration <= 0) return;
    const rect = track.getBoundingClientRect();
    onSeek(xToTime(event.clientX, rect.left, rect.width, { start: 0, end: duration }));
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || duration <= 0) return;
    const target = event.target;
    if (target instanceof Element && target.closest("[data-review-note]")) return;
    event.preventDefault();
    markUserInteraction();
    scrubRef.current = { pointerId: event.pointerId, wasPaused: paused };
    event.currentTarget.setPointerCapture(event.pointerId);
    if (!paused) onPause();
    seekAtPointer(event);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (scrubRef.current?.pointerId === event.pointerId) seekAtPointer(event);
  };

  const finishScrub = (event: ReactPointerEvent<HTMLDivElement>) => {
    const scrub = scrubRef.current;
    if (!scrub || scrub.pointerId !== event.pointerId) return;
    scrubRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!scrub.wasPaused) onPlay();
    markUserInteraction();
  };

  const tickInterval = timelineTickInterval(pixelsPerSecond);
  const firstTick = Math.ceil(window.start / tickInterval) * tickInterval;
  const tickCount =
    window.end >= firstTick ? Math.floor((window.end - firstTick) / tickInterval) + 1 : 0;
  const visibleNotes = notes.filter((note) => {
    const end = note.end ?? note.start;
    return note.start <= window.end && end >= window.start;
  });

  return (
    <section className="review-timeline" aria-label={t("reviewTimeline", locale)}>
      <div className="review-timeline-heading">
        <strong>{t("reviewTimeline", locale)}</strong>
        <div className="review-zoom-controls">
          <button
            type="button"
            aria-label={t("reviewZoomOut", locale)}
            title={t("reviewZoomOut", locale)}
            onClick={() => changeZoom(-1)}
          >
            <Minus size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={t("reviewZoomIn", locale)}
            title={t("reviewZoomIn", locale)}
            onClick={() => changeZoom(1)}
          >
            <Plus size={15} aria-hidden="true" />
          </button>
          <button type="button" onClick={fitTimeline}>
            {t("reviewFit", locale)}
          </button>
        </div>
      </div>
      <div
        ref={viewportRef}
        className="review-timeline-viewport"
        onScroll={(event) => setScrollLeft(event.currentTarget.scrollLeft)}
        onPointerDownCapture={markUserInteraction}
        onPointerMoveCapture={(event) => {
          if (event.buttons !== 0) markUserInteraction();
        }}
      >
        <div
          ref={trackRef}
          className="review-timeline-track"
          style={{ width: trackWidth }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishScrub}
          onPointerCancel={finishScrub}
        >
          {tickCount > 0 &&
            Array.from({ length: tickCount }, (_, index) => {
              const time = firstTick + index * tickInterval;
              const left = timeToX(time, 0, trackWidth, { start: 0, end: duration });
              return (
                <div className="review-timeline-tick" key={time} style={{ left }}>
                  <span>{formatTime(time)}</span>
                </div>
              );
            })}
          {visibleNotes.map((note) => {
            const start = Math.min(Math.max(note.start, 0), duration);
            const end = Math.min(Math.max(note.end ?? note.start, start), duration);
            const left = timeToX(start, 0, trackWidth, { start: 0, end: duration });
            const right = timeToX(end, 0, trackWidth, { start: 0, end: duration });
            return (
              <button
                type="button"
                key={note.id}
                data-review-note
                className={`review-timeline-note${note.end === null ? " review-timeline-note--point" : ""}`}
                title={`${formatTime(note.start)}${note.end === null ? "" : `–${formatTime(note.end)}`}: ${note.text}`}
                aria-label={`${formatTime(note.start)}: ${note.text}`}
                style={{ left, width: Math.max(3, right - left) }}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  onSeek(note.start);
                }}
              />
            );
          })}
          <div
            className="review-timeline-playhead"
            style={{ left: timeToX(currentTime, 0, trackWidth, { start: 0, end: duration }) }}
          />
        </div>
      </div>
    </section>
  );
}
