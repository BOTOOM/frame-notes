export interface TimeWindow {
  start: number;
  end: number;
}

export function detailWindow(center: number, width: number, duration: number): TimeWindow {
  if (!Number.isFinite(duration) || duration <= 0) return { start: 0, end: 0 };
  const span = Math.min(Math.max(Number.isFinite(width) ? width : 0, 0), duration);
  const midpoint = Number.isFinite(center) ? center : 0;
  const start = Math.min(Math.max(midpoint - span / 2, 0), duration - span);
  return { start, end: start + span };
}

export function xToTime(x: number, left: number, width: number, window: TimeWindow): number {
  if (width <= 0 || window.end <= window.start) return window.start;
  const ratio = Math.min(1, Math.max(0, (x - left) / width));
  return window.start + ratio * (window.end - window.start);
}

export function timeToX(time: number, left: number, width: number, window: TimeWindow): number {
  if (window.end <= window.start) return left;
  const ratio = Math.min(1, Math.max(0, (time - window.start) / (window.end - window.start)));
  return left + ratio * width;
}

export function nudgeFrames(
  time: number,
  deltaFrames: number,
  fps: number,
  duration: number,
): number {
  if (!Number.isFinite(fps) || fps <= 0) return Math.min(Math.max(time, 0), Math.max(duration, 0));
  const frame = Math.round(time * fps) + Math.round(deltaFrames);
  const nextTime = frame / fps;
  return Math.min(Math.max(nextTime, 0), Math.max(duration, 0));
}
