/* biome-ignore-all lint/style/useTemplate: Keep the exact public configuration expressions required by the spec. */
const configuredSiteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? "https://" + process.env.VERCEL_PROJECT_PRODUCTION_URL
    : "http://localhost:3000");
export const siteUrl = configuredSiteUrl.replace(/\/+$/, "");
export const repoUrl = "https://github.com/BOTOOM/frame-notes";
export const releasesUrl = repoUrl + "/releases/latest";
export const chromeWebStoreUrl =
  "https://chromewebstore.google.com/detail/frame-notes/alfmkhdlkkpdflhkcanfkdgfggilhemo";
export const issuesUrl = repoUrl + "/issues";
export const legal = {
  owner: process.env.NEXT_PUBLIC_LEGAL_OWNER ?? null,
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? null,
  effectiveDate: process.env.NEXT_PUBLIC_LEGAL_EFFECTIVE_DATE ?? null,
};
