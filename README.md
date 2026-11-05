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

The same main actions are registered as extension commands and can be remapped
from the browser's extension shortcut settings.

## Review-notes files

For each Studio project, notes are stored in extension-local browser storage and
mirrored to the project root as:

- `review-notes.json`: the versioned `NotesDoc` source of truth.
- `review-notes.md`: a readable, agent-oriented list of composition times and
  frame numbers.

Times are composition time in seconds. Frame numbers are rounded using the
composition's fps. An agent working on the project should read
`review-notes.md` before editing, use each time range as the review target, and
leave the files in place; deleting every note writes an empty document rather
than deleting either file.

## Development

Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and
`pnpm build:firefox`. Project notes remain local-only when Studio's file API is
unavailable.