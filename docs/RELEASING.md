# Releasing Frame Notes

## Versioning

Releases are created from `main` by semantic-release. Versions are calculated
from Conventional Commits and tagged as `v<version>`; do not bump the extension
version manually.

| Commit | Version change |
| --- | --- |
| `feat:` | Minor |
| `fix:`, `perf:`, `refactor:`, `chore(deps):` | Patch |
| Any commit with a `BREAKING CHANGE:` footer | Major |

There are no release tags yet, so the first release will be `1.0.0`. The release
workflow temporarily synchronizes that version into the extension package for
WXT builds. It does not commit the generated version or changelog back to
`main`.

## Running a release

Push a change to `main` that touches `apps/extension/**`, the root
`package.json`, `pnpm-lock.yaml`, or `.github/workflows/release.yml`. The
workflow runs lint, typecheck, tests, Chrome and Firefox builds, and ZIP
packaging before semantic-release calculates and creates a release.

To run it manually, open **Actions → Release → Run workflow** and select
`main`. The inputs are:

- `skip_tests` (default `false`): bypasses the test job; reserve for emergency
  releases.
- `dry_run` (default `false`): calculates a release without creating it and
  passes `--dry-run` to any configured store submission.
- `publish_stores` (default `true`): set to `false` to create the GitHub
  release without submitting it to stores.

The workflow only releases from `main`. If a store is not fully configured, its
submission is skipped; if none are configured, the GitHub release still
completes normally.

## Release assets

Each GitHub release includes:

- `frame-notes-<version>-chrome.zip` — Chrome, Edge, and Opera package.
- `frame-notes-<version>-firefox.xpi` — unsigned Firefox package for AMO.
- `frame-notes-<version>-sources.zip` — Firefox source archive for AMO review.

Every CI validation run also uploads Chrome and Firefox ZIP artifacts, available
for 14 days from the workflow run.

## Store credentials

Add credentials under **Settings → Secrets and variables → Actions**. Secrets
are passed to `wxt submit` through its documented uppercase environment
variables and are never printed by the workflow.

| Store | Required repository secrets | Required repository variable | Where to get them |
| --- | --- | --- | --- |
| Chrome Web Store | `CHROME_EXTENSION_ID`, `CHROME_PUBLISHER_ID`, `CHROME_SERVICE_ACCOUNT_CLIENT_EMAIL`, `CHROME_SERVICE_ACCOUNT_PRIVATE_KEY` | — | Get the extension and publisher IDs from the Chrome Web Store Developer Dashboard. Enable the Chrome Web Store API in Google Cloud, create a service account, and grant that account access to the extension in the dashboard. Store its client email and private key as secrets. |
| Firefox AMO | `FIREFOX_JWT_ISSUER`, `FIREFOX_JWT_SECRET` | `FIREFOX_GECKO_ID` | Create API credentials in the AMO developer hub. Set the add-on's Gecko ID as the repository variable; use the ID assigned to the AMO listing. |
| Microsoft Edge Add-ons | `EDGE_PRODUCT_ID`, `EDGE_CLIENT_ID`, `EDGE_API_KEY` | — | Get the product ID from the Partner Center add-on listing, then create API credentials in the Partner Center API access settings. |

`FIREFOX_GECKO_ID` is optional for builds. WXT adds it to the Firefox manifest
only when this repository variable is non-empty. Do not invent a Gecko ID; set
the ID assigned to the AMO listing before enabling automated AMO submission.

Opera submission is not automated because its API requires a browser session
ID; upload the Chrome ZIP manually through the Opera add-ons developer portal.
Safari is not supported because release packaging requires macOS, Xcode, and an
Apple Developer account.
