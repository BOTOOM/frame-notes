import type { Metadata } from "next";
import { LandingPage } from "@/components/landing-page";
import { SiteLayout } from "@/components/site-layout";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
    languages: { es: "/", en: "/en" },
  },
};

export default function SpanishHomePage() {
  return (
    <SiteLayout locale="es" path="/">
      <LandingPage locale="es" />
    </SiteLayout>
  );
}
