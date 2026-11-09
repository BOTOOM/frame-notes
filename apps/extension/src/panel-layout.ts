export const minListHeight = 96;

export function clampListHeight(height: number, available: number): number {
  if (available < minListHeight) return Math.max(0, Math.round(available));

  return Math.round(Math.max(minListHeight, Math.min(height, available)));
}
