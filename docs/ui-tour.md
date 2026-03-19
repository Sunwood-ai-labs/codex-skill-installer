# Codex Skill Installer UI Tour

This note captures the current desktop flow after the Tauri 2 migration, the flattened custom window chrome pass, the typography cleanup, compact-height scaling fixes, and the bilingual UI pass.

## Tabs

The app is organized around three top-level tabs:

- `Setup`: lock the repository URL, optional ref override, destination folder, and overwrite policy before inspection.
- `Shortlist`: review detected skill folders before selecting what should actually be installed.
- `Transcript`: keep a running ledger of inspect and install events in one place.

The title bar also includes a persisted `EN / 日本語` toggle so the desktop shell can be operated in English or Japanese without changing the workflow structure. The current chrome sits flush with the window frame instead of floating inside an outer margin.

## Setup

The `Setup` tab is the operator desk. It keeps the source and destination fields alongside a short workflow summary so the operator can confirm the archive target before generating a shortlist.

English:

![Setup tab in English at 1280x820](screenshots/setup-bilingual-en-1280x820.png)

Japanese:

![Setup tab in Japanese at 1280x820](screenshots/setup-bilingual-ja-1280x820.png)

## Shortlist

The `Shortlist` tab is intentionally review-first. It is meant to feel like a curation table rather than a bulk-import step.

![Shortlist tab at 1280x820](screenshots/shortlist-1280x820.png)

## Transcript

The `Transcript` tab keeps status messages and install outcomes in a dedicated ledger view so async operations stay visible while the rest of the UI remains compact.

![Transcript tab at 1280x820](screenshots/transcript-1280x820.png)

## Validation Note

These screenshots were refreshed from the current app on `2026-03-19` after the tabbed desktop layout, the flattened title bar chrome pass, the locale typography cleanup, compact-height scaling adjustments, and the bilingual UI pass.

Checks executed:

- `npm run build`
- `npm run tauri dev`
- Renderer screenshots captured at `1280x820`, including both English and Japanese `Setup` states
