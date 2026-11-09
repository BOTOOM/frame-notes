import type { Metadata } from "next";
import { LandingPage } from "@/components/landing-page";
import { SiteLayout } from "@/components/site-layout";
import { createPageMetadata } from "@/src/page-metadata";

export const metadata: Metadata = createPageMetadata({
  locale: "en",
  path: "/en",
  esPath: "/",
  enPath: "/en",
});

export default function EnglishHomePage() {
  return (
    <SiteLayout locale="en" path="/en">
      <LandingPage locale="en" />
    </SiteLayout>
  );
}
