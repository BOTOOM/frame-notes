import type { Metadata } from "next";
import { LandingPage } from "@/components/landing-page";
import { SiteLayout } from "@/components/site-layout";

export const metadata: Metadata = {
  alternates: {
    canonical: "/en",
    languages: { es: "/", en: "/en" },
  },
};

export default function EnglishHomePage() {
  return (
    <SiteLayout locale="en" path="/en">
      <LandingPage locale="en" />
    </SiteLayout>
  );
}
