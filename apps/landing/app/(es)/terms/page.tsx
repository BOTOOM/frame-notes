import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { SiteLayout } from "@/components/site-layout";

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description: "Términos de uso de Frame Notes.",
  alternates: {
    canonical: "/terms",
    languages: { es: "/terms", en: "/en/terms" },
  },
};

export default function SpanishTermsPage() {
  return (
    <SiteLayout locale="es" path="/terms">
      <LegalPage kind="terms" locale="es" />
    </SiteLayout>
  );
}
