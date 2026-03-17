# Codex Skill Installer

Codex Skill Installer is a cross-platform desktop app for installing Codex skills from GitHub into your local Codex profile.

It follows the common Codex layout:

- Any platform with `CODEX_HOME`: `CODEX_HOME/skills`
- Windows fallback: `%USERPROFILE%\\.codex\\skills`
- macOS/Linux fallback: `~/.codex/skills`

## What It Does

- Accepts a GitHub repository URL, `tree` URL, or `blob` URL that points at a skill.
- Downloads a repository snapshot and scans for directories that contain `SKILL.md`.
- Lets you pick one or more discovered skills from a GUI list.
- Installs those skills into your local Codex skills directory.
- Protects existing skill folders unless you explicitly enable overwrite.

## Quick Start

```powershell
uv sync --all-groups
uv run codex-skill-installer
```

You can also launch it with:

```powershell
uv run python -m codex_skill_forge
```

## Desktop Build (UV + PyInstaller)

Build a native executable for your current platform with:

```powershell
uv sync --group build
uv run python scripts/build_desktop.py
```

The default build mode is `onedir`, which is the safer cross-platform option.
You can opt into `onefile` when you specifically want a single-file bundle:

```powershell
uv run python scripts/build_desktop.py --mode onefile
```

Add a suffix explicitly for CI or naming consistency:

```powershell
uv run python scripts/build_desktop.py --artifact-suffix linux
```

Artifacts are written to `dist/` by default:

- `onedir`: `dist/codex-skill-installer[-suffix]/`
- `onefile` on Linux/macOS: `dist/codex-skill-installer[-suffix]`
- `onefile` on Windows: `dist/codex-skill-installer[-suffix].exe`

The exact artifact shape can vary slightly by platform, especially on macOS, so treat the
generated `dist/` output as the source of truth for release packaging.

For project automation and release-style packaging, a GitHub Actions workflow is available at
`.github/workflows/build-desktop.yml` and builds artifacts on Linux, macOS, and Windows.

PyInstaller requires building on each target OS separately, so the workflow uses a matrix build
instead of trying to cross-compile from one runner.

## Supported Inputs

- `https://github.com/owner/repo`
- `https://github.com/owner/repo/tree/main/path/to/skill`
- `https://github.com/owner/repo/blob/main/path/to/skill/SKILL.md`

The optional `Ref` field in the app can override the ref embedded in the URL.

## Development

Run the test suite:

```powershell
uv run pytest
```

Run a quick import check:

```powershell
uv run python -m compileall src
```

## Notes

- The current implementation is designed around GitHub repository archives.
- Public GitHub repositories are the primary verified path.
- Existing destination directories are skipped unless `Overwrite existing skill folders` is enabled.
