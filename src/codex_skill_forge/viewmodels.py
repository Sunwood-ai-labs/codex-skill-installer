"""View model layer for the skill installer GUI."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional, Protocol
from urllib.parse import urlparse


class SkillInstallerService(Protocol):
    """Service interface used by the GUI layer."""

    def detect_skills(self, repository_url: str, ref: Optional[str] = None) -> list["SkillCandidate"]:
        """Return detected skill candidates from a repository."""

    def install_skills(
        self,
        repository_url: str,
        candidates: list["SkillCandidate"],
        destination: Path,
        overwrite: bool = False,
        ref: Optional[str] = None,
    ) -> "SkillInstallResult":
        """Install selected candidates into destination and return structured result."""


@dataclass(frozen=True)
class SkillCandidate:
    """A single skill candidate discovered from repository metadata."""

    name: str
    path: str
    skill_type: str = "unknown"
    description: str = ""
    source_ref: Optional[str] = None


@dataclass(frozen=True)
class InstallOutcome:
    """Installation result for one candidate."""

    candidate: SkillCandidate
    installed: bool
    skipped: bool
    message: str
    destination: Path
    details: dict[str, Any] = field(default_factory=dict)

    @property
    def status_label(self) -> str:
        if self.installed:
            return "installed"
        if self.skipped:
            return "skipped"
        return "failed"


@dataclass
class SkillInspectResult:
    """Structured result of repository inspection."""

    ok: bool
    repository_url: str
    ref: Optional[str]
    candidates: list[SkillCandidate] = field(default_factory=list)
    error_message: Optional[str] = None
    logs: list[str] = field(default_factory=list)


@dataclass
class SkillInstallResult:
    """Structured result of an install attempt."""

    ok: bool
    repository_url: str
    destination: Path
    ref: Optional[str]
    overwrite: bool
    candidates: list[SkillCandidate] = field(default_factory=list)
    outcomes: list[InstallOutcome] = field(default_factory=list)
    error_message: Optional[str] = None
    logs: list[str] = field(default_factory=list)

    @property
    def summary(self) -> str:
        installed = len([o for o in self.outcomes if o.installed])
        skipped = len([o for o in self.outcomes if o.skipped])
        failed = len([o for o in self.outcomes if (not o.installed and not o.skipped)])
        return f"{installed} installed, {skipped} skipped, {failed} failed"


class SkillInstallerViewModel:
    """Thin orchestrator between GUI and service layer."""

    def __init__(self, service: SkillInstallerService):
        self._service = service

    @staticmethod
    def validate_inputs(github_url: str, destination: Path) -> list[str]:
        """Validate user inputs and return list of issues."""
        issues: list[str] = []
        if not github_url or not github_url.strip():
            issues.append("Repository URL is required.")
        elif not _is_github_url(github_url):
            issues.append("Repository URL must be a valid GitHub URL.")

        if not str(destination).strip():
            issues.append("Destination directory is required.")
        elif destination.exists() and not destination.is_dir():
            issues.append("Destination path must be a directory.")

        return issues

    @staticmethod
    def validate_candidates(candidates: list[SkillCandidate]) -> list[str]:
        if not candidates:
            return ["No skill candidates selected."]
        seen: set[str] = set()
        duplicates: set[str] = set()
        for candidate in candidates:
            normalized = candidate.name.strip().lower()
            if normalized in seen:
                duplicates.add(candidate.name)
            else:
                seen.add(normalized)
        if duplicates:
            joined = ", ".join(sorted(duplicates))
            return [f"Selected skills would install to duplicate names: {joined}"]
        return []

    def inspect(self, repository_url: str, ref: Optional[str] = None) -> SkillInspectResult:
        """Fetch and validate detected candidates."""
        try:
            candidates = self._service.detect_skills(repository_url, ref=ref)
            logs = [f"Detected {len(candidates)} skill candidate(s)."]
            return SkillInspectResult(
                ok=True,
                repository_url=repository_url,
                ref=ref,
                candidates=candidates,
                logs=logs,
            )
        except Exception as exc:  # noqa: BLE001
            return SkillInspectResult(
                ok=False,
                repository_url=repository_url,
                ref=ref,
                error_message=str(exc) or "Unexpected error while inspecting repository.",
            )

    def install(
        self,
        repository_url: str,
        candidates: list[SkillCandidate],
        destination: Path,
        overwrite: bool,
        ref: Optional[str] = None,
    ) -> SkillInstallResult:
        """Install selected candidates via service."""
        issues = self.validate_inputs(repository_url, destination)
        issues.extend(self.validate_candidates(candidates))
        if issues:
            return SkillInstallResult(
                ok=False,
                repository_url=repository_url,
                destination=destination,
                ref=ref,
                overwrite=overwrite,
                candidates=candidates,
                error_message="; ".join(issues),
            )

        try:
            result = self._service.install_skills(
                repository_url=repository_url,
                candidates=candidates,
                destination=destination,
                overwrite=overwrite,
                ref=ref,
            )
            return result
        except Exception as exc:  # noqa: BLE001
            return SkillInstallResult(
                ok=False,
                repository_url=repository_url,
                destination=destination,
                ref=ref,
                overwrite=overwrite,
                candidates=candidates,
                error_message=str(exc) or "Unexpected error while installing skills.",
            )


def _is_github_url(value: str) -> bool:
    parsed = urlparse(value.strip())
    return (
        parsed.scheme in {"https", "http"}
        and parsed.netloc.lower() in {"github.com", "www.github.com"}
        and bool(parsed.path.strip("/"))
    )


@dataclass(frozen=True)
class NoService:
    """Fallback service with deterministic behavior for launch-time verification."""

    message: str = "No service layer has been connected."

    def detect_skills(self, repository_url: str, ref: Optional[str] = None) -> list[SkillCandidate]:
        if not repository_url:
            raise ValueError("Repository URL is empty.")
        return []

    def install_skills(
        self,
        repository_url: str,
        candidates: list[SkillCandidate],
        destination: Path,
        overwrite: bool = False,
        ref: Optional[str] = None,
    ) -> SkillInstallResult:
        raise RuntimeError(self.message)
