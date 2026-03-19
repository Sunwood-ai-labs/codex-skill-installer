# Codex Skill Installer

Codex Skill Installer is now a Tauri 2 desktop app with a React + TypeScript frontend and a Rust core.

It keeps the original workflow while giving the desktop shell a more deliberate, review-first layout:

- Paste a GitHub repository, `tree`, or `blob` URL.
- Inspect the repository for directories that contain `SKILL.md`.
- Select one or more detected skills.
- Install them into your local Codex skills directory.
- Skip existing folders unless overwrite is enabled.
- Move through top-level `Setup`, `Shortlist`, and `Transcript` tabs instead of one long scrolling view.
- Switch the desktop UI between English and Japanese with a persisted `EN / 日本語` control in the custom title bar.

The default install target still follows the common Codex layout:

- `CODEX_HOME/skills` when `CODEX_HOME` is set
- Windows fallback: `%USERPROFILE%\.codex\skills`
- macOS/Linux fallback: `~/.codex/skills`

## Stack

- Tauri `2.10.3`
- React `19`
- TypeScript `5.9`
- Vite `8`
- Rust backend commands for GitHub archive download, safe extraction, skill discovery, and installation

## Prerequisites

- Node.js `20+`
- Rust toolchain installed and available on `PATH`
- Tauri OS prerequisites:
  - Windows: WebView2 runtime plus the standard Rust MSVC toolchain
  - macOS: Xcode command line tools
  - Linux: WebKitGTK and related desktop build dependencies

Official references:

- [Tauri prerequisites](https://tauri.app/start/prerequisites/)
- [Tauri crate](https://crates.io/crates/tauri)

## Quick Start

```powershell
npm install
npm run tauri dev
```

## Screenshot

The current desktop shell uses a custom Tauri title bar, a persisted `EN / 日本語` language toggle, and a compact-height layout that keeps the `Setup` tab readable around `1280x820`.

![Setup tab screenshot](docs/screenshots/setup-bilingual-en-1280x820.png)

## Documentation

- [UI tour](docs/ui-tour.md)

## Production Build

```powershell
npm run tauri build
```

Build output is written under `src-tauri/target/release/bundle/`.

## Web Build Check

If you only want to validate the React frontend without compiling Rust:

```powershell
npm run build
```

## Supported Inputs

- `https://github.com/owner/repo`
- `https://github.com/owner/repo/tree/main/path/to/skill`
- `https://github.com/owner/repo/blob/main/path/to/skill/SKILL.md`

The optional `Ref override` field can replace the ref embedded in the URL.

## Development Notes

- The app performs GitHub archive download and extraction in Rust, not in the browser.
- Unsafe archive paths are rejected during extraction.
- Install results preserve the original `installed / skipped / failed` outcome model.
- The folder picker is implemented as a native desktop dialog through the Tauri host side.
- The desktop chrome is custom-drawn so the app can style its own title bar and window controls.
- The desktop workspace is split into top-level `Setup`, `Shortlist`, and `Transcript` tabs.
- The UI locale can be switched between English and Japanese, and the chosen locale is stored in local storage.

## Validation

- Frontend typecheck + bundle: `npm run build`
- Rust unit tests: `cargo test --manifest-path src-tauri/Cargo.toml`
- UI evidence: tracked screenshots under `docs/screenshots/`, including English and Japanese captures at `1280x820`

## CI

GitHub Actions builds Windows, macOS, and Linux desktop bundles from `.github/workflows/build-desktop.yml`.
