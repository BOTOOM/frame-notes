# Frame Notes

## Commands

- Install: `pnpm install`
- Lint: `pnpm lint`
- Typecheck: `pnpm typecheck`
- Tests: `pnpm test`
- Build: `pnpm build` and `pnpm build:firefox`

## Layout

- `apps/extension/entrypoints`: WXT content, bridge, background, and popup entrypoints.
- `apps/extension/src`: note model, localization, persistence, and UI modules.
- `tests`: pure unit tests for formatting and synchronization.

## Conventions

- Use pnpm for workspace operations, TypeScript strict mode, and Biome.
- Keep injected UI inside its Shadow DOM; read Studio DOM (detection, geometry) from the content script, and go through the player bridge for MAIN-world player state and commands.
- Keep persisted notes in seconds and mirror project files with conditional writes.
