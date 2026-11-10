/* biome-ignore-all lint/security/noDangerouslySetInnerHtml: JSON-LD serialization escapes "<" to prevent script-tag injection. */
import { chromeWebStoreUrl, legal, releasesUrl, repoUrl, siteUrl } from "../site.config";
import { type Locale, landingContent, seoMetadata } from "../src/content";

export function HomepageJsonLd({ locale }: { locale: Locale }) {
  const copy = landingContent[locale];
  const homePath = locale === "es" ? "/" : "/en";
  const localeCode = locale === "es" ? "es" : "en";
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: "Frame Notes",
        url: siteUrl,
        inLanguage: localeCode,
      },
      {
        "@type": "SoftwareApplication",
        name: "Frame Notes",
        applicationCategory: "MultimediaApplication",
        operatingSystem: "Chrome, Firefox",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
        url: new URL(homePath, siteUrl).toString(),
        installUrl: chromeWebStoreUrl,
        downloadUrl: releasesUrl,
        license: "https://www.apache.org/licenses/LICENSE-2.0",
        sameAs: [repoUrl, chromeWebStoreUrl],
        description: seoMetadata[locale].description,
        inLanguage: localeCode,
        ...(legal.owner ? { author: { "@type": "Person", name: legal.owner } } : {}),
      },
      {
        "@type": "FAQPage",
        mainEntity: copy.faq.items.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph).replace(/</g, "\\u003c") }}
    />
  );
}
