import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { SiteLayout } from "@/components/site-layout";
import { createPageMetadata } from "@/src/page-metadata";

export const metadata: Metadata = createPageMetadata({
  locale: "en",
  path: "/en/terms",
  esPath: "/terms",
  enPath: "/en/terms",
  title: "Terms and conditions",
  description: "Terms of use for Frame Notes.",
});

export default function EnglishTermsPage() {
  return (
    <SiteLayout locale="en" path="/en/terms">
      <LegalPage kind="terms" locale="en" />
    </SiteLayout>
  );
}
