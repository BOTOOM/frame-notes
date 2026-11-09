import type { Metadata } from "next";
import type { ReactNode } from "react";
import { seoMetadata } from "@/src/content";
import { siteUrl } from "../../site.config";
import "../globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: seoMetadata.es.title,
    template: "%s | Frame Notes",
  },
  description: seoMetadata.es.description,
  openGraph: {
    type: "website",
    siteName: "Frame Notes",
    locale: "es_ES",
    alternateLocale: "en_US",
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: "Frame Notes" }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/opengraph-image.png"],
  },
};

export default function SpanishRootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
