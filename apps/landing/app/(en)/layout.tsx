import type { Metadata } from "next";
import type { ReactNode } from "react";
import { siteUrl } from "../../site.config";
import "../globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Frame Notes — review notes for HyperFrames Studio",
    template: "%s | Frame Notes",
  },
  description:
    "Frame-accurate review notes for HyperFrames Studio. Mark time ranges and give your agent clear context.",
  openGraph: {
    type: "website",
    siteName: "Frame Notes",
    locale: "en_US",
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
