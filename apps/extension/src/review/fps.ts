export const REVIEW_FRAME_RATES = [23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60] as const;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const lower = sorted[middle - 1] ?? 0;
  const upper = sorted[middle] ?? 0;
  return sorted.length % 2 === 0 ? (lower + upper) / 2 : upper;
}

export function estimateFps(mediaTimeDeltas: number[]): number | null {
  const valid = mediaTimeDeltas.filter((delta) => Number.isFinite(delta) && delta > 0);
  if (valid.length < 10) return null;
  const center = median(valid);
  const typical = valid.filter((delta) => Math.abs(delta - center) <= center * 0.25);
  if (typical.length < 10) return null;

  const fps = 1 / median(typical);
  const nearest = REVIEW_FRAME_RATES.reduce((best, rate) =>
    Math.abs(rate - fps) < Math.abs(best - fps) ? rate : best,
  );
  return Math.abs(nearest - fps) / nearest <= 0.03 ? nearest : Number(fps.toFixed(2));
}
