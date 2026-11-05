import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { SiteLayout } from "@/components/site-layout";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How Frame Notes stores notes locally and which services may receive requests.",
  alternates: {
    canonical: "/en/privacy",
    languages: { es: "/privacy", en: "/en/privacy" },
  },
};

export default function EnglishPrivacyPage() {
  return (
    <SiteLayout locale="en" path="/en/privacy">
      <LegalPage kind="privacy" locale="en" />
    </SiteLayout>
  );
}
