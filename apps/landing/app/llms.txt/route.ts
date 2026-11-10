import { chromeWebStoreUrl, releasesUrl, repoUrl, siteUrl } from "../../site.config";
import { type Locale, landingContent, seoMetadata } from "../../src/content";
import { legalContent } from "../../src/legal-content";

export const dynamic = "force-static";

function contentText() {
  const copy = landingContent.en;
  const localStorage = legalContent.en.privacy.sections.find(
    (section) => section.title === "Local storage",
  );
  const dictation = legalContent.en.privacy.sections.find(
    (section) => section.title === "Optional dictation",
  );
  const localizedLinks: Record<Locale, string> = {
    es: `${siteUrl}/`,
    en: `${siteUrl}/en`,
  };

  return [
    "# Frame Notes",
    "",
    `> ${seoMetadata.en.description}`,
    "",
    "## Key facts",
    `- What it does: ${copy.hero.description}`,
    `- Where notes are saved: ${localStorage?.paragraphs?.join(" ") ?? copy.privacySummary.body}`,
    `- Project handoff: ${copy.howToUse.agentNote}`,
    `- Local dictation: ${dictation?.paragraphs?.[0] ?? ""}`,
    `- Privacy: ${copy.privacySummary.body}`,
    `- Browsers: ${copy.install.chromeTitle}; ${copy.install.firefoxTitle}.`,
    "",
    "## Pages",
    `- [Spanish home](${localizedLinks.es})`,
    `- [English home](${localizedLinks.en})`,
    `- [Privacy](${siteUrl}/en/privacy)`,
    `- [Terms](${siteUrl}/en/terms)`,
    "",
    "## Links",
    `- Chrome Web Store: ${chromeWebStoreUrl}`,
    `- [GitHub repository](${repoUrl})`,
    `- [GitHub Releases](${releasesUrl})`,
    "",
  ].join("\n");
}

export function GET() {
  return new Response(contentText(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
