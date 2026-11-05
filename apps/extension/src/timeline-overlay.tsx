import { useEffect, useState } from "react";
import { formatTime, type Note, sortNotes } from "./model";

interface TimelineGeometry {
  left: number;
  top: number;
  width: number;
  height: number;
  layerLeft: number;
  pixelsPerSecond: number;
}

interface TimelineOverlayProps {
  notes: Note[];
  activeNoteId: string | null;
  hoveredNoteId: string | null;
}

export function TimelineOverlay({ notes, activeNoteId, hoveredNoteId }: TimelineOverlayProps) {
  const [geometry, setGeometry] = useState<TimelineGeometry | null>(null);

  useEffect(() => {
    let viewport: HTMLElement | null = null;
    let layer: HTMLElement | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let styleObserver: MutationObserver | null = null;
    let replacementObserver: MutationObserver | null = null;
    let animationFrame = 0;

    const setGeometryIfChanged = (next: TimelineGeometry | null) => {
      setGeometry((previous) => {
        if (
          previous &&
          next &&
          previous.left === next.left &&
          previous.top === next.top &&
          previous.width === next.width &&
          previous.height === next.height &&
          previous.layerLeft === next.layerLeft &&
          previous.pixelsPerSecond === next.pixelsPerSecond
        ) {
          return previous;
        }
        return next;
      });
    };

    const measure = () => {
      if (animationFrame) return;
      animationFrame = requestAnimationFrame(() => {
        animationFrame = 0;
        const nextViewport = document.querySelector<HTMLElement>("[data-timeline-scroll-viewport]");
        const nextLayer =
          nextViewport?.querySelector<HTMLElement>("[data-timeline-time-layer]") ?? null;
        if (nextViewport !== viewport || nextLayer !== layer) {
          viewport?.removeEventListener("scroll", measure);
          resizeObserver?.disconnect();
          styleObserver?.disconnect();
          viewport = nextViewport;
          layer = nextLayer;
          if (viewport) {
            viewport.addEventListener("scroll", measure, { passive: true });
            resizeObserver = new ResizeObserver(measure);
            resizeObserver.observe(viewport);
          }
          if (layer) {
            resizeObserver ??= new ResizeObserver(measure);
            resizeObserver.observe(layer);
            styleObserver = new MutationObserver(measure);
            styleObserver.observe(layer, { attributes: true, attributeFilter: ["style"] });
          }
        }
        if (!viewport || !layer) {
          setGeometryIfChanged(null);
          return;
        }

        const viewportRect = viewport.getBoundingClientRect();
        const layerRect = layer.getBoundingClientRect();
        const viewportStyle = getComputedStyle(viewport);
        if (
          viewportRect.width <= 0 ||
          viewportRect.height <= 0 ||
          layerRect.width <= 0 ||
          viewportStyle.display === "none" ||
          viewportStyle.visibility === "hidden" ||
          viewportStyle.opacity === "0"
        ) {
          setGeometryIfChanged(null);
          return;
        }
        setGeometryIfChanged({
          left: viewportRect.left,
          top: viewportRect.top,
          width: viewportRect.width,
          height: viewportRect.height,
          layerLeft: layerRect.left,
          pixelsPerSecond: layerRect.width,
        });
      });
    };

    const checkReplacement = () => {
      const nextViewport = document.querySelector<HTMLElement>("[data-timeline-scroll-viewport]");
      const nextLayer =
        nextViewport?.querySelector<HTMLElement>("[data-timeline-time-layer]") ?? null;
      if (nextViewport !== viewport || nextLayer !== layer) measure();
    };

    replacementObserver = new MutationObserver(checkReplacement);
    replacementObserver.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    measure();
    return () => {
      replacementObserver?.disconnect();
      resizeObserver?.disconnect();
      styleObserver?.disconnect();
      viewport?.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, []);

  if (!geometry) return null;
  return (
    <div
      className="fn-timeline-overlay"
      aria-hidden="true"
      style={{
        left: geometry.left,
        top: geometry.top,
        width: geometry.width,
        height: geometry.height,
      }}
    >
      {sortNotes(notes).map((note) => {
        const left = geometry.layerLeft + note.start * geometry.pixelsPerSecond - geometry.left;
        const isHighlighted = note.id === activeNoteId || note.id === hoveredNoteId;
        const sharedStyle = {
          left,
          height: geometry.height,
        };
        return note.end === null ? (
          <div
            key={note.id}
            className="fn-timeline-note-point"
            data-highlighted={isHighlighted ? "true" : undefined}
            style={sharedStyle}
            title={`${formatTime(note.start)}: ${note.text}`}
          />
        ) : (
          <div
            key={note.id}
            className="fn-timeline-note-range"
            data-highlighted={isHighlighted ? "true" : undefined}
            style={{
              ...sharedStyle,
              width: Math.max(2, (note.end - note.start) * geometry.pixelsPerSecond),
            }}
            title={`${formatTime(note.start)}–${formatTime(note.end)}: ${note.text}`}
          />
        );
      })}
    </div>
  );
}
