"""Cross-platform path helpers for Codex skill storage."""

from __future__ import annotations

import os
import sys
from pathlib import Path


def _platform_name(platform: str | None = None) -> str:
    value = (platform or sys.platform).lower()
    if value.startswith("win"):
        return "windows"
    if value.startswith("darwin"):
        return "macos"
    if value.startswith("linux"):
        return "linux"
    return value


def get_codex_platform_label(platform: str | None = None) -> str:
    return _platform_name(platform=platform)


def get_codex_skills_dir(platform: str | None = None) -> Path:
    """Return the default skills directory for the current runtime.

    The precedence is:
    1) CODEX_HOME environment variable (explicit override).
    2) PLATFORM_HOME/.codex/skills
    where PLATFORM_HOME is:
      - Windows: USERPROFILE
      - macOS/Linux and others: HOME
    """

    codex_home = os.getenv("CODEX_HOME")
    if codex_home:
        return Path(codex_home).expanduser() / "skills"

    platform_name = _platform_name(platform)
    if platform_name == "windows":
        base_home = os.getenv("USERPROFILE") or os.getenv("HOME") or str(Path.home())
    else:
        base_home = os.getenv("HOME") or str(Path.home())

    return Path(base_home).expanduser() / ".codex" / "skills"
