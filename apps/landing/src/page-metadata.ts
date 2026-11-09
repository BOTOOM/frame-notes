import type { Metadata } from "next";
import { siteUrl } from "../site.config";
import { type Locale, seoMetadata } from "./content";

interface PageMetadataOptions {
  locale: Locale;
  path: string;
  esPath: string;
  enPath: string;
  title?: string;
  description?: string;
}

function absoluteUrl(path: string): string {
  return new URL(path, siteUrl).toString();
}

export function createPageMetadata({
  locale,
  path,
  esPath,
  enPath,
  title,
  description,
}: PageMetadataOptions): Metadata {
  const defaultCopy = seoMetadata[locale];

  return {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    alternates: {
      canonical: absoluteUrl(path),
      languages: {
        es: absoluteUrl(esPath),
        en: absoluteUrl(enPath),
        "x-default": absoluteUrl("/"),
      },
    },
    openGraph: {
      type: "website",
      siteName: "Frame Notes",
      title: title ?? defaultCopy.title,
      description: description ?? defaultCopy.description,
      url: absoluteUrl(path),
      locale: locale === "es" ? "es_ES" : "en_US",
      alternateLocale: locale === "es" ? "en_US" : "es_ES",
      images: [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: "Frame Notes" }],
    },
  };
}
