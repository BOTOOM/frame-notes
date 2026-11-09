import type { Metadata } from "next";
import type { ReactNode } from "react";
import { seoMetadata } from "@/src/content";
import { siteUrl } from "../../site.config";
import "../globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: seoMetadata.en.title,
    template: "%s | Frame Notes",
  },
  description: seoMetadata.en.description,
  openGraph: {
    type: "website",
    siteName: "Frame Notes",
    locale: "en_US",
    alternateLocale: "es_ES",
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: "Frame Notes" }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/opengraph-image.png"],
  },
};

export default function EnglishRootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
