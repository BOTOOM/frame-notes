const nonExtensionScopes = ["landing", "readme"];
const changelogTypes = [
  { type: "feat", section: "Features" },
  { type: "fix", section: "Bug Fixes" },
  { type: "perf", section: "Performance" },
  { type: "refactor", section: "Refactoring" },
  { type: "docs", section: "Documentation" },
  { type: "chore", section: "Maintenance" },
];

module.exports = {
  branches: ["main"],
  tagFormat: `v\${version}`,
  plugins: [
    [
      "@semantic-release/commit-analyzer",
      {
        preset: "conventionalcommits",
        releaseRules: [
          { type: "feat", release: "minor" },
          { type: "fix", release: "patch" },
          { type: "perf", release: "patch" },
          { type: "refactor", release: "patch" },
          { type: "chore", scope: "deps", release: "patch" },
          { breaking: true, scope: null, release: "major" },
          {
            breaking: true,
            scope: `!(${nonExtensionScopes.join("|")})`,
            release: "major",
          },
          ...nonExtensionScopes.map((scope) => ({ scope, release: false })),
        ],
      },
    ],
    [
      "@semantic-release/release-notes-generator",
      {
        preset: "conventionalcommits",
        presetConfig: {
          types: [
            ...nonExtensionScopes.flatMap((scope) =>
              changelogTypes.map(({ type }) => ({ type, scope, hidden: true })),
            ),
            ...changelogTypes,
          ],
        },
      },
    ],
    ["@semantic-release/changelog", { changelogFile: "CHANGELOG.md" }],
    [
      "@semantic-release/exec",
      {
        prepareCmd: `node ../../scripts/sync-extension-version.mjs \${nextRelease.version} && pnpm zip && pnpm zip:firefox && mkdir -p .output/release && cp .output/*-chrome.zip .output/release/frame-notes-\${nextRelease.version}-chrome.zip && cp .output/*-firefox.zip .output/release/frame-notes-\${nextRelease.version}-firefox.xpi && cp .output/*-sources.zip .output/release/frame-notes-\${nextRelease.version}-sources.zip`,
        successCmd: `if [ -n "$GITHUB_OUTPUT" ]; then printf 'version=%s\\n' '\${nextRelease.version}' >> "$GITHUB_OUTPUT"; fi`,
      },
    ],
    [
      "@semantic-release/github",
      {
        assets: [
          {
            path: ".output/release/*-chrome.zip",
            name: `frame-notes-\${nextRelease.version}-chrome.zip`,
            label: `Frame Notes \${nextRelease.version} — Chrome / Edge / Opera (.zip)`,
          },
          {
            path: ".output/release/*-firefox.xpi",
            name: `frame-notes-\${nextRelease.version}-firefox.xpi`,
            label: `Frame Notes \${nextRelease.version} — Firefox (.xpi, unsigned)`,
          },
          {
            path: ".output/release/*-sources.zip",
            name: `frame-notes-\${nextRelease.version}-sources.zip`,
            label: `Frame Notes \${nextRelease.version} — Source code for AMO review`,
          },
        ],
      },
    ],
  ],
};
