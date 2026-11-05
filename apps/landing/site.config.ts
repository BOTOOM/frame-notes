/* biome-ignore-all lint/style/useTemplate: Keep the exact public configuration expressions required by the spec. */
export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
export const repoUrl = "https://github.com/BOTOOM/frame-notes";
export const releasesUrl = repoUrl + "/releases/latest";
export const issuesUrl = repoUrl + "/issues";
export const legal = {
  owner: process.env.NEXT_PUBLIC_LEGAL_OWNER ?? null,
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? null,
  effectiveDate: null,
};
