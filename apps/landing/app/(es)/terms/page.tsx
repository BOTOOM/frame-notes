import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { SiteLayout } from "@/components/site-layout";
import { createPageMetadata } from "@/src/page-metadata";

export const metadata: Metadata = createPageMetadata({
  locale: "es",
  path: "/terms",
  esPath: "/terms",
  enPath: "/en/terms",
  title: "Términos y condiciones",
  description: "Términos de uso de Frame Notes.",
});

export default function SpanishTermsPage() {
  return (
    <SiteLayout locale="es" path="/terms">
      <LegalPage kind="terms" locale="es" />
    </SiteLayout>
  );
}
