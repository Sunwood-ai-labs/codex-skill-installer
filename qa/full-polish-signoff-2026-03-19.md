# Full Polish QA Inventory

Date: 2026-03-19
Mode: complete polish (`完全整備`)
Repository: `D:\Prj\codex-skill-forge`
Remote: `https://github.com/Sunwood-ai-labs/codex-skill-installer`

## Requested Outcomes

- Carry the repository through a full public-facing polish pass.
- Use the repository-polish workflow end to end.
- Use Spark Legion style parallelization as far as the runtime allows.

## Expected Artifact Changes

- `README.md`
- `README.ja.md`
- `LICENSE` if a safe choice can be supported
- `docs/` content and/or docs site scaffolding
- `docs/.vitepress/**` if a browsable docs site is added
- `docs/public/**` or other docs-owned brand assets if a reusable visual identity is added
- `package.json`
- `package-lock.json`
- `.github/workflows/**`
- `src-tauri/Cargo.toml`
- `src-tauri/src/core.rs`
- optional small frontend/runtime fixes in owned source files if validation finds correctness issues
- repository metadata fields if GitHub auth is available and the final public setup benefits from them

## Final Claims Planned

- The repository now has a stronger public-facing README experience.
- Japanese and English onboarding surfaces are both available.
- Documentation is coherent, linked, and locally buildable.
- CI and docs publishing workflows match the current repository structure.
- Public repo metadata is aligned with the polished docs surface if auth allows updating it.
- Verification covered the changed docs, workflows, and runtime/build surfaces.
- Changes were committed in small recoverable steps and pushed if no blocker remained.

## Structural QA Checklist

- README links, commands, badges, and language switch
- `README.ja.md` structure parity against `README.md`
- docs navigation, page reachability, and locale parity
- docs build command and output directory
- workflow paths, triggers, and artifact directories
- Pages base URL matches `codex-skill-installer`
- GitHub metadata fields after update attempt
- git status after commits and push

## Codebase QA Targets

- README hero and onboarding sections
- English docs landing page and one guide page
- Japanese docs landing page and one guide page
- VitePress config, nav, sidebar, and locale wiring if added
- build/test commands for frontend and Rust
- source-level correctness for any runtime strings or test fixes

## Known Risks / Decisions

- Choosing a software license is a legal choice; only add `LICENSE` if a safe inference is available.
- Existing PowerShell output shows mojibake for Japanese strings, so runtime validation must rely on build/UI evidence rather than console rendering alone.
- GitHub Pages currently appears disabled (`404` on Pages API), so enablement must be checked explicitly if Pages deployment is added.
