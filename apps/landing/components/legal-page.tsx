import Link from "next/link";
import { issuesUrl, legal, repoUrl } from "../site.config";
import type { Locale } from "../src/content";
import { type LegalPageKind, legalContent } from "../src/legal-content";

interface LegalPageProps {
  locale: Locale;
  kind: LegalPageKind;
}

export function LegalPage({ locale, kind }: LegalPageProps) {
  const copy = legalContent[locale][kind];
  const isPrivacy = kind === "privacy";

  return (
    <article className="legal-page page-wrap">
      <div className="eyebrow">
        <span className="eyebrow-mark" />
        {isPrivacy ? (locale === "es" ? "PRIVACIDAD" : "PRIVACY") : "TERMS"}
      </div>
      <h1>{copy.title}</h1>
      <p className="legal-intro">{copy.intro}</p>
      <div className="legal-meta">
        {legal.owner ? (
          <p>
            <span>{copy.ownerLabel}</span> {legal.owner}
          </p>
        ) : null}
        {legal.effectiveDate ? (
          <p>
            <span>{copy.effectiveDateLabel}</span> {legal.effectiveDate}
          </p>
        ) : null}
      </div>
      <div className="legal-content">
        {copy.sections.map((section) => (
          <section className="legal-section" key={section.title}>
            <h2>{section.title}</h2>
            {section.paragraphs?.map((paragraph) => (
              <p key={paragraph}>
                {kind === "terms" && section.title === "Open-source license" && locale === "en" ? (
                  <>
                    Frame Notes is distributed under the{" "}
                    <a href={`${repoUrl}/blob/main/LICENSE`}>Apache License 2.0</a>. The full
                    license is available in the repository&apos;s LICENSE file.
                  </>
                ) : kind === "terms" &&
                  section.title === "Licencia de código abierto" &&
                  locale === "es" ? (
                  <>
                    Frame Notes se distribuye bajo la{" "}
                    <a href={`${repoUrl}/blob/main/LICENSE`}>Licencia Apache 2.0</a>. La licencia
                    completa está disponible en el archivo LICENSE del repositorio.
                  </>
                ) : (
                  paragraph
                )}
              </p>
            ))}
            {section.items ? (
              <ul>
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>
      <div className="legal-contact">
        <span className="section-index">{locale === "es" ? "CONTACTO" : "CONTACT"}</span>
        <h2>{copy.contactLabel}</h2>
        {legal.contactEmail ? (
          <a href={`mailto:${legal.contactEmail}`}>{legal.contactEmail}</a>
        ) : (
          <Link href={issuesUrl}>GitHub Issues</Link>
        )}
      </div>
    </article>
  );
}
