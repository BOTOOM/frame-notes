import Image from "next/image";
import Link from "next/link";
import { chromeWebStoreUrl, releasesUrl, repoUrl } from "../site.config";
import { copyExample, type Locale, landingContent } from "../src/content";
import { HomepageJsonLd } from "./homepage-json-ld";

interface LandingPageProps {
  locale: Locale;
}

export function LandingPage({ locale }: LandingPageProps) {
  const copy = landingContent[locale];

  return (
    <>
      <HomepageJsonLd locale={locale} />
      <section className="hero page-wrap">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="eyebrow-mark" />
            {copy.hero.eyebrow}
          </div>
          <h1>{copy.hero.title}</h1>
          <p className="hero-description">{copy.hero.description}</p>
          <div className="hero-actions">
            <a className="button button-primary" href={chromeWebStoreUrl}>
              {copy.hero.primaryCta}
              <span aria-hidden="true">↗</span>
            </a>
            <a className="button button-ghost" href={releasesUrl}>
              {copy.hero.secondaryCta}
              <span aria-hidden="true">↗</span>
            </a>
          </div>
          <p className="local-note">
            <span aria-hidden="true" className="local-dot" />
            <span>
              <strong className="browser-availability">{copy.hero.browserAvailability}</strong> ·{" "}
              {copy.hero.localNote}
            </span>
          </p>
          <a className="inline-link" href={repoUrl}>
            {copy.hero.repositoryLink} <span>↗</span>
          </a>
        </div>
        <figure className="hero-media">
          <div className="media-window">
            <div aria-hidden="true" className="media-window-bar">
              <span />
              <span />
              <span />
              <code>localhost · HyperFrames Studio</code>
            </div>
            <video
              aria-label={copy.hero.mediaCaption}
              autoPlay
              className="demo-video"
              loop
              muted
              playsInline
              poster="/media/hero.png"
              preload="metadata"
            >
              <source src="/media/demo.webm" type="video/webm" />
              <Image
                alt={copy.hero.mediaCaption}
                height={900}
                sizes="(max-width: 760px) 100vw, 55vw"
                src="/media/demo.gif"
                width={1440}
              />
            </video>
          </div>
          <figcaption className="media-caption">
            <span className="caption-line" />
            {copy.hero.mediaCaption}
          </figcaption>
        </figure>
        <div aria-hidden="true" className="hero-index">
          FN / 01
        </div>
      </section>

      <section className="audience-section section-wrap" id="audience">
        <div className="section-kicker">
          <span className="section-index">01</span>
          <span>{copy.audience.eyebrow}</span>
        </div>
        <div className="audience-grid">
          <h2>{copy.audience.title}</h2>
          <div>
            <p>{copy.audience.body}</p>
            <span className="text-tag">{copy.audience.tag}</span>
          </div>
        </div>
      </section>

      <section className="features-section section-wrap" id="features">
        <div className="section-heading">
          <div className="section-kicker">
            <span className="section-index">02</span>
            <span>{copy.features.eyebrow}</span>
          </div>
          <h2>{copy.features.title}</h2>
        </div>
        <div className="feature-grid">
          {copy.features.items.map((feature) => (
            <article className="feature-card" key={feature.index}>
              <span className="feature-index">{feature.index}</span>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="install-section section-wrap" id="install">
        <div className="section-heading">
          <div className="section-kicker">
            <span className="section-index">03</span>
            <span>{copy.install.eyebrow}</span>
          </div>
          <h2>{copy.install.title}</h2>
        </div>
        <div className="install-grid">
          <article className="install-card">
            <span className="install-label">01 / CHROMIUM</span>
            <h3>{copy.install.chromeTitle}</h3>
            <ol>
              {copy.install.chromeSteps.map((step) => (
                <li key={step.text}>
                  {step.link ? (
                    <a href={step.link === "chromeWebStore" ? chromeWebStoreUrl : releasesUrl}>
                      {step.text}
                    </a>
                  ) : (
                    step.text
                  )}
                </li>
              ))}
            </ol>
          </article>
          <article className="install-card">
            <span className="install-label">02 / GECKO</span>
            <h3>{copy.install.firefoxTitle}</h3>
            <ol>
              {copy.install.firefoxSteps.map((step) => (
                <li key={step.text}>
                  {step.link ? <a href={releasesUrl}>{step.text}</a> : step.text}
                </li>
              ))}
            </ol>
          </article>
        </div>
        <a className="inline-link" href={releasesUrl}>
          {locale === "es" ? "Abrir descargas de GitHub" : "Open GitHub releases"} <span>↗</span>
        </a>
      </section>

      <section className="how-section section-wrap" id="how-to-use">
        <div className="section-heading">
          <div className="section-kicker">
            <span className="section-index">04</span>
            <span>{copy.howToUse.eyebrow}</span>
          </div>
          <h2>{copy.howToUse.title}</h2>
        </div>
        <div className="steps-grid">
          {copy.howToUse.steps.map((step) => (
            <article className="step-card" key={step.number}>
              <div className="step-media">
                <Image
                  alt={step.alt}
                  height={760}
                  sizes="(max-width: 760px) 100vw, 33vw"
                  src={step.image}
                  width={1200}
                />
              </div>
              <div className="step-copy">
                <span className="step-number">{step.number}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
        <p className="agent-note">
          <span aria-hidden="true" className="accent-rule" />
          {copy.howToUse.agentNote}
        </p>
      </section>

      <section className="copy-section section-wrap">
        <div className="copy-intro">
          <div className="section-kicker">
            <span className="section-index">05</span>
            <span>{copy.copy.eyebrow}</span>
          </div>
          <h2>{copy.copy.title}</h2>
          <p>{copy.copy.body}</p>
        </div>
        <figure className="code-card">
          <figcaption>
            <span className="code-mark" />
            {copy.copy.caption}
          </figcaption>
          <pre>
            <code>{copyExample[locale]}</code>
          </pre>
        </figure>
      </section>

      <section className="shortcut-section section-wrap">
        <div className="section-heading">
          <div className="section-kicker">
            <span className="section-index">06</span>
            <span>{copy.shortcuts.eyebrow}</span>
          </div>
          <h2>{copy.shortcuts.title}</h2>
        </div>
        <div className="shortcut-list">
          {copy.shortcuts.rows.map((shortcut) => (
            <div className="shortcut-row" key={shortcut.keys}>
              <kbd>{shortcut.keys}</kbd>
              <span>{shortcut.action}</span>
            </div>
          ))}
        </div>
        <p className="shortcut-note">{copy.shortcuts.browserNote}</p>
      </section>

      <section className="theme-section section-wrap">
        <div className="theme-copy">
          <div className="section-kicker">
            <span className="section-index">07</span>
            <span>{copy.themes.eyebrow}</span>
          </div>
          <h2>{copy.themes.title}</h2>
          <p>{copy.themes.body}</p>
        </div>
        <figure className="theme-media">
          <Image
            alt={copy.themes.alt}
            height={900}
            sizes="(max-width: 760px) 100vw, 50vw"
            src="/media/paper-panel.png"
            width={1440}
          />
          <figcaption>{locale === "es" ? "PAPEL / VISTA CLARA" : "PAPER / LIGHT VIEW"}</figcaption>
        </figure>
      </section>

      <section className="privacy-callout section-wrap" id="privacy-summary">
        <div className="privacy-stamp" aria-hidden="true">
          LOCAL
          <br />
          FIRST
        </div>
        <div>
          <div className="section-kicker">
            <span className="section-index">08</span>
            <span>{locale === "es" ? "Tus datos" : "Your data"}</span>
          </div>
          <h2>{copy.privacySummary.title}</h2>
          <p>{copy.privacySummary.body}</p>
          <Link className="inline-link" href={locale === "es" ? "/privacy" : "/en/privacy"}>
            {copy.privacySummary.link} <span>→</span>
          </Link>
        </div>
      </section>

      <section className="faq-section section-wrap">
        <div className="section-heading">
          <div className="section-kicker">
            <span className="section-index">09</span>
            <span>{copy.faq.eyebrow}</span>
          </div>
          <h2>{copy.faq.title}</h2>
        </div>
        <div className="faq-list">
          {copy.faq.items.map((item) => (
            <details className="faq-item" key={item.question}>
              <summary>
                <span>{item.question}</span>
                <span aria-hidden="true" className="faq-toggle">
                  +
                </span>
              </summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
