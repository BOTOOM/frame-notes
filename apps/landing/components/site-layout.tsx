import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { issuesUrl, releasesUrl, repoUrl } from "../site.config";
import { type Locale, landingContent } from "../src/content";

interface SiteLayoutProps {
  children: ReactNode;
  locale: Locale;
  path: string;
}

function translatedPath(path: string, locale: Locale): string {
  if (locale === "es") return path === "/" ? "/en" : `/en${path}`;
  if (path === "/en") return "/";
  return path.replace(/^\/en(?=\/|$)/, "") || "/";
}

export function SiteLayout({ children, locale, path }: SiteLayoutProps) {
  const copy = landingContent[locale];
  const homePath = locale === "es" ? "/" : "/en";

  return (
    <div className="site-frame">
      <header className="site-header">
        <div className="header-inner">
          <Link aria-label="Frame Notes home" className="brand" href={homePath}>
            <Image
              alt=""
              className="brand-mark"
              height={38}
              sizes="38px"
              src="/logo.svg"
              width={38}
            />
            <span className="brand-copy">
              <strong>Frame Notes</strong>
              <span>REVIEW NOTES / HYPERFRAMES STUDIO</span>
            </span>
          </Link>
          <nav
            aria-label={locale === "es" ? "Navegación principal" : "Main navigation"}
            className="main-nav"
          >
            <Link href={`${homePath}#audience`}>{copy.nav.audience}</Link>
            <Link href={`${homePath}#features`}>{copy.nav.features}</Link>
            <Link href={`${homePath}#how-to-use`}>{copy.nav.howToUse}</Link>
            <Link href={locale === "es" ? "/privacy" : "/en/privacy"}>{copy.nav.privacy}</Link>
          </nav>
          <div className="header-actions">
            <Link
              aria-label={copy.nav.languageLabel}
              className="language-link"
              href={translatedPath(path, locale)}
            >
              {locale === "es" ? "EN" : "ES"}
            </Link>
            <a className="button button-small button-primary" href={releasesUrl}>
              {copy.nav.download}
              <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      </header>
      <main>{children}</main>
      <footer className="site-footer">
        <div className="footer-top">
          <Link className="brand footer-brand" href={homePath}>
            <Image
              alt=""
              className="brand-mark"
              height={34}
              sizes="34px"
              src="/logo.svg"
              width={34}
            />
            <span className="brand-copy">
              <strong>Frame Notes</strong>
              <span>LOCAL REVIEW NOTES</span>
            </span>
          </Link>
          <nav
            aria-label={locale === "es" ? "Enlaces del pie de página" : "Footer links"}
            className="footer-links"
          >
            <Link href={locale === "es" ? "/privacy" : "/en/privacy"}>{copy.footer.privacy}</Link>
            <Link href={locale === "es" ? "/terms" : "/en/terms"}>{copy.footer.terms}</Link>
            <a href={repoUrl}>{copy.footer.github}</a>
            <a href={issuesUrl}>{locale === "es" ? "Incidencias" : "Issues"}</a>
          </nav>
        </div>
        <p className="disclaimer">{copy.disclaimer}</p>
        <p className="copyright">Open-source software · Apache License 2.0</p>
      </footer>
    </div>
  );
}
