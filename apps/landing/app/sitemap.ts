import type { MetadataRoute } from "next";
import { siteUrl } from "../site.config";

const absoluteUrl = (path: string) => new URL(path, siteUrl).toString();

function localizedEntry(esPath: string, enPath: string, priority: number) {
  return [
    {
      url: absoluteUrl(esPath),
      alternates: { languages: { es: absoluteUrl(esPath), en: absoluteUrl(enPath) } },
      priority,
    },
    {
      url: absoluteUrl(enPath),
      alternates: { languages: { es: absoluteUrl(esPath), en: absoluteUrl(enPath) } },
      priority,
    },
  ];
}

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...localizedEntry("/", "/en", 1),
    ...localizedEntry("/privacy", "/en/privacy", 0.3),
    ...localizedEntry("/terms", "/en/terms", 0.3),
  ];
}
