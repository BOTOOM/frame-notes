export type ReviewExportExtension = "md" | "json";

export function reviewExportName(fileName: string, extension: ReviewExportExtension): string {
  const basename = fileName.split(/[\\/]/).pop() ?? "";
  const dot = basename.lastIndexOf(".");
  const stem = dot > 0 ? basename.slice(0, dot) : basename;
  const safeStem =
    stem
      .replace(/[<>:"/\\|?*\p{Cc}]/gu, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[.-]+|[.-]+$/g, "") || "video";
  return `${safeStem}.review-notes.${extension}`;
}
