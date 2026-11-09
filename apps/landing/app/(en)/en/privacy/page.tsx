import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { SiteLayout } from "@/components/site-layout";
import { createPageMetadata } from "@/src/page-metadata";

export const metadata: Metadata = createPageMetadata({
  locale: "en",
  path: "/en/privacy",
  esPath: "/privacy",
  enPath: "/en/privacy",
  title: "Privacy policy",
  description: "How Frame Notes stores notes locally and which services may receive requests.",
});

export default function EnglishPrivacyPage() {
  return (
    <SiteLayout locale="en" path="/en/privacy">
      <LegalPage kind="privacy" locale="en" />
    </SiteLayout>
  );
}
