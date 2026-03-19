# Codex Skill Installer Docs

<p align="center">
  <img src="brand/codex-skill-installer-mark.svg" alt="Codex Skill Installer mark" width="120">
</p>

<p align="center">
  Review-first docs for the desktop app that installs Codex skills from GitHub.
</p>

English · [日本語](ja/index.md)

## What This Covers

This docs area mirrors the public README and expands the desktop flow into a concise UI tour. It is meant to help new readers understand the app quickly without having to inspect the code first.

## Entry Points

- [UI tour](ui-tour.md)
- [Japanese docs landing](ja/index.md)
- [GitHub repository](https://github.com/Sunwood-ai-labs/codex-skill-installer)

## What You Can Confirm Here

- The review-first flow across `Setup`, `Shortlist`, and `Transcript`
- The default Codex skills install locations
- The current verification commands for frontend, docs, and desktop packaging
- The bilingual navigation structure used by the docs site

## Screenshot Notes

The tracked screenshots are embedded in the [UI tour](ui-tour.md) and its [Japanese counterpart](ja/ui-tour.md), where VitePress can ship them as stable site assets.

## Common Paths

- Default install target: `CODEX_HOME/skills` or `~/.codex/skills`
- Production build: `npm run tauri build`
- Frontend verification: `npm run build`
