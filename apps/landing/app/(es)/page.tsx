import type { Metadata } from "next";
import { LandingPage } from "@/components/landing-page";
import { SiteLayout } from "@/components/site-layout";
import { createPageMetadata } from "@/src/page-metadata";

export const metadata: Metadata = createPageMetadata({
  locale: "es",
  path: "/",
  esPath: "/",
  enPath: "/en",
});

export default function SpanishHomePage() {
  return (
    <SiteLayout locale="es" path="/">
      <LandingPage locale="es" />
    </SiteLayout>
  );
}
