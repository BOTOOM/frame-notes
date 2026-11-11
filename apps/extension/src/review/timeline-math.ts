import type { TimeWindow } from "../timeline-math";

const tickIntervals = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600];

export function clampTimelineZoom(zoom: number, duration: number): number {
  const maxZoom = Math.max(1, (Number.isFinite(duration) ? Math.max(duration, 0) : 0) / 2);
  return Math.min(Math.max(Number.isFinite(zoom) ? zoom : 1, 1), maxZoom);
}

export function reviewPixelsPerSecond(
  viewportWidth: number,
  duration: number,
  zoom: number,
): number {
  if (viewportWidth <= 0 || duration <= 0) return 0;
  return (viewportWidth / duration) * clampTimelineZoom(zoom, duration);
}

export function reviewTimelineWidth(viewportWidth: number, duration: number, zoom: number): number {
  return Math.max(viewportWidth, duration * reviewPixelsPerSecond(viewportWidth, duration, zoom));
}

export function visibleTimelineWindow(
  scrollLeft: number,
  viewportWidth: number,
  pixelsPerSecond: number,
  duration: number,
): TimeWindow {
  if (pixelsPerSecond <= 0 || duration <= 0) return { start: 0, end: 0 };
  const start = Math.min(Math.max(scrollLeft / pixelsPerSecond, 0), duration);
  const end = Math.min(Math.max((scrollLeft + viewportWidth) / pixelsPerSecond, start), duration);
  return { start, end };
}

export function timelineTickInterval(pixelsPerSecond: number, minSpacing = 76): number {
  if (pixelsPerSecond <= 0) return tickIntervals[tickIntervals.length - 1] ?? 3600;
  return (
    tickIntervals.find((interval) => interval * pixelsPerSecond >= minSpacing) ??
    tickIntervals[tickIntervals.length - 1] ??
    3600
  );
}
