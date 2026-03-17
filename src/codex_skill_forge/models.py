"""Typed models for GitHub skill discovery and installation."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from typing import Any


class SkillForgeError(ValueError):
    """Base error type for skill installer operations."""


class GitHubUrlError(SkillForgeError):
    """Raised when a GitHub repository URL cannot be parsed."""


class GitHubDownloadError(SkillForgeError):
    """Raised when downloading or extracting an archive fails."""


class DuplicateSkillError(SkillForgeError):
    """Raised when two skills collide in selection/installation path."""


class ParsedRepoInfo:
    """Normalized GitHub repository information used by the service layer."""

    def __init__(
        self,
        owner: str,
        repo: str,
        ref: str,
        scope_path: str,
        source_url: str,
    ) -> None:
        self.owner = owner
        self.repo = repo
        self.ref = ref
        self.scope_path = scope_path.strip("/")
        self.source_url = source_url

    @property
    def full_name(self) -> str:
        return f"{self.owner}/{self.repo}"

    @property
    def scoped(self) -> bool:
        return bool(self.scope_path)

    @property
    def scope_posix(self) -> str:
        return self.scope_path

    def as_dict(self) -> dict[str, str]:
        return {
            "owner": self.owner,
            "repo": self.repo,
            "ref": self.ref,
            "scope_path": self.scope_path,
            "source_url": self.source_url,
            "full_name": self.full_name,
        }


@dataclass(frozen=True)
class SkillDescriptor:
    """Represents one installable skill directory in a repository snapshot."""

    relative_path: str
    destination_name: str
    manifest_path: str
    has_subskills: bool = False

    @property
    def identifier(self) -> str:
        return self.relative_path if self.relative_path not in {"", "."} else self.destination_name

    @property
    def parent_path(self) -> str:
        return self.relative_path if self.relative_path else "."

    @property
    def source_path(self) -> str:
        return self.relative_path if self.relative_path else "."

    @property
    def display_name(self) -> str:
        return self.destination_name.replace("\\", "/")

    def as_dict(self) -> dict[str, str | bool]:
        return {
            "relative_path": self.relative_path,
            "destination_name": self.destination_name,
            "manifest_path": self.manifest_path,
            "parent_path": self.parent_path,
            "display_name": self.display_name,
            "has_subskills": self.has_subskills,
        }


class InstallStatus(Enum):
    INSTALLED = "installed"
    SKIPPED = "skipped"
    FAILED = "failed"


@dataclass(frozen=True)
class SkillInstallEntry:
    """Result of one attempted skill installation."""

    skill_identifier: str
    source_path: str
    destination: str
    status: InstallStatus
    message: str | None = None

    def as_dict(self) -> dict[str, str | None]:
        return {
            "skill_identifier": self.skill_identifier,
            "source_path": self.source_path,
            "destination": self.destination,
            "status": self.status.value,
            "message": self.message,
        }


@dataclass(frozen=True)
class SkillDiscoveryResult:
    """Structured result for UI list operations."""

    source: ParsedRepoInfo
    skills: tuple[SkillDescriptor, ...]
    errors: tuple[str, ...] = ()
    snapshot_ref: str | None = None

    @property
    def count(self) -> int:
        return len(self.skills)

    def as_dict(self) -> dict[str, Any]:
        return {
            "source": self.source.as_dict(),
            "snapshot_ref": self.snapshot_ref,
            "count": self.count,
            "skills": [s.as_dict() for s in self.skills],
            "errors": list(self.errors),
        }


@dataclass(frozen=True)
class InstallPlan:
    """Resolved selection for installation."""

    source: ParsedRepoInfo
    selected_skills: tuple[SkillDescriptor, ...]
    requested: tuple[str, ...]
    snapshot_ref: str
    temporary_root: str
    target_root: str
    overwrite_allowed: bool = False


@dataclass(frozen=True)
class InstallResult:
    """Structured result for install flows, suitable for UI rendering."""

    source: ParsedRepoInfo
    snapshot_ref: str
    target_root: str
    requested: tuple[str, ...]
    installed: tuple[SkillInstallEntry, ...]
    skipped: tuple[SkillInstallEntry, ...]
    failed: tuple[SkillInstallEntry, ...]
    errors: tuple[str, ...] = ()
    completed_at_utc: str = ""

    def __post_init__(self) -> None:
        if not self.completed_at_utc:
            object.__setattr__(
                self,  # type: ignore[arg-type]
                "completed_at_utc",
                datetime.now(timezone.utc).isoformat(),
            )

    @property
    def status(self) -> str:
        if self.failed:
            return "failed"
        if self.skipped and not self.installed:
            return "skipped"
        if self.installed and not self.failed:
            return "partial" if self.skipped else "success"
        return "success"

    @property
    def totals(self) -> dict[str, int]:
        return {
            "requested": len(self.requested),
            "installed": len(self.installed),
            "skipped": len(self.skipped),
            "failed": len(self.failed),
            "total": len(self.installed) + len(self.skipped) + len(self.failed),
        }

    def as_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "source": self.source.as_dict(),
            "snapshot_ref": self.snapshot_ref,
            "target_root": self.target_root,
            "requested": list(self.requested),
            "installed": [item.as_dict() for item in self.installed],
            "skipped": [item.as_dict() for item in self.skipped],
            "failed": [item.as_dict() for item in self.failed],
            "errors": list(self.errors),
            "totals": self.totals,
            "completed_at_utc": self.completed_at_utc,
        }
