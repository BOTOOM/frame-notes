export const minPanelHeight = 240;

export function clampPanelHeight(
  height: number,
  top: number,
  viewportHeight: number,
  margin: number,
): number {
  const maxViewportHeight = viewportHeight - 2 * margin;
  if (maxViewportHeight < minPanelHeight) return Math.max(0, maxViewportHeight);

  return Math.round(
    Math.min(
      maxViewportHeight,
      Math.max(minPanelHeight, Math.min(height, viewportHeight - top - margin)),
    ),
  );
}
