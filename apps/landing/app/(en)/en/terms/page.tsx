import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { SiteLayout } from "@/components/site-layout";

export const metadata: Metadata = {
  title: "Terms and conditions",
  description: "Terms of use for Frame Notes.",
  alternates: {
    canonical: "/en/terms",
    languages: { es: "/terms", en: "/en/terms" },
  },
};

export default function EnglishTermsPage() {
  return (
    <SiteLayout locale="en" path="/en/terms">
      <LegalPage kind="terms" locale="en" />
    </SiteLayout>
  );
}
