import type { Metadata } from "next";
import type { ReactNode } from "react";
import { siteUrl } from "../../site.config";
import "../globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Frame Notes — notas de revisión para HyperFrames Studio",
    template: "%s | Frame Notes",
  },
  description:
    "Notas de revisión precisas al cuadro para HyperFrames Studio. Anota rangos de tiempo y comparte contexto con tu agente.",
  openGraph: {
    type: "website",
    siteName: "Frame Notes",
    locale: "es_ES",
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
