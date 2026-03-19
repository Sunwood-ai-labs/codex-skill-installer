---
name: root-skill-fixture
description: Minimal root-level skill manifest for lowercase skill.md smoke tests.
---

# Root Skill Fixture

This fixture exists to verify that a repository with `skill.md` at the root is
detected and installed as a skill.

## Verification Notes

- The detected candidate path should be `.`
- The destination folder should use the repository name
- Supporting files should be copied alongside the manifest
