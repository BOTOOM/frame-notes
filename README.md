# Frame Notes

Frame Notes is a Chrome and Firefox extension for writing time-range review notes
while a local HyperFrames Studio preview is open. Add a note with **Alt+N**; the
player pauses, a draft opens at the current composition time, and the text field
is ready to type without opening the toolbar popup.

## Install from source

Requirements: Node.js and pnpm.

```sh
pnpm install
pnpm build
```

- **Chrome:** open `chrome://extensions`, enable Developer mode, choose **Load
  unpacked**, and select `apps/extension/.output/chrome-mv3`.
- **Firefox:** run `pnpm build:firefox`, open `about:debugging#/runtime/this-firefox`,
  choose **Load Temporary Add-on**, and select
  `apps/extension/.output/firefox-mv2/manifest.json`.

The extension runs on Studio previews at `http://localhost:<port>/#project/<id>`
and `http://127.0.0.1:<port>/#project/<id>`.

## Shortcuts

- **Alt+N:** pause and start a new note at the playhead.
- **Alt+I / Alt+O:** set the edited note's start / end to the playhead. Alt+I
  starts a draft when none is open; Alt+O updates the most recently edited note.
- **Enter / Shift+Enter:** save / insert a newline.
- **Escape:** cancel the draft or edit.
- **Alt+Shift+C:** copy all notes.
- **Alt+M:** minimize or expand the panel.
- **Alt+V:** start on-device dictation in the editor, creating a note at the
  playhead when needed.

The same main actions are registered as extension commands and can be remapped
from the browser's extension shortcut settings.

The popup's **Dictation engine** setting selects Auto, Chrome on-device, or
Whisper (local). Chrome language packs and the Whisper model are downloaded only
after an in-panel confirmation. Dictation audio is processed on this device.
Whisper uses the `onnx-community/whisper-base` model, with WebGPU fp16 when
available and WASM q8 otherwise.

## Review-notes files

For each Studio project, notes are stored in extension-local browser storage and
mirrored to the project root as:

- `review-notes.json`: the versioned `NotesDoc` source of truth.
- `review-notes.md`: a readable, agent-oriented list of composition times and
  frame numbers.

Times are composition time in seconds. Frame numbers are rounded using the
composition's fps. While a Studio tab for the project is open, the extension
owns these files and may overwrite them during sync. Agents should read
`review-notes.md` rather than edit either file, use each time range as the review
target, and leave the files in place; deleting every note writes an empty
document rather than deleting either file.

## Development

Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and
`pnpm build:firefox`. Project notes remain local-only when Studio's file API is
unavailable.

## Releasing

See [docs/RELEASING.md](docs/RELEASING.md) for automated versioning, releases,
and extension-store submissions.

## Deploying the landing on Vercel

Create a Vercel project for this repository with **Root Directory** set to
`apps/landing`. Set `NEXT_PUBLIC_SITE_URL` to the landing's canonical HTTPS URL
and assign the chosen subdomain in the Vercel project settings. Vercel builds
the Next.js app natively; `apps/landing/vercel.json` skips builds when a change
does not touch the landing app.

The landing's privacy policy and terms are informational and are not legal
advice. Optional legal/contact values can be configured with
`NEXT_PUBLIC_LEGAL_OWNER` and `NEXT_PUBLIC_CONTACT_EMAIL`; unset values remain
omitted, with GitHub Issues used as the contact channel.