import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { SiteLayout } from "@/components/site-layout";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description:
    "Cómo Frame Notes guarda las notas localmente y qué servicios pueden recibir solicitudes.",
  alternates: {
    canonical: "/privacy",
    languages: { es: "/privacy", en: "/en/privacy" },
  },
};

export default function SpanishPrivacyPage() {
  return (
    <SiteLayout locale="es" path="/privacy">
      <LegalPage kind="privacy" locale="es" />
    </SiteLayout>
  );
}
