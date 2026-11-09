import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { SiteLayout } from "@/components/site-layout";
import { createPageMetadata } from "@/src/page-metadata";

export const metadata: Metadata = createPageMetadata({
  locale: "es",
  path: "/privacy",
  esPath: "/privacy",
  enPath: "/en/privacy",
  title: "Política de privacidad",
  description:
    "Cómo Frame Notes guarda las notas localmente y qué servicios pueden recibir solicitudes.",
});

export default function SpanishPrivacyPage() {
  return (
    <SiteLayout locale="es" path="/privacy">
      <LegalPage kind="privacy" locale="es" />
    </SiteLayout>
  );
}
