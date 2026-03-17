"""Service layer: discovery and installation orchestration."""

from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Iterable

from .github_client import GitHubClient
from .installer import SkillInstaller
from .models import (
    DuplicateSkillError,
    GitHubDownloadError,
    InstallPlan,
    InstallResult,
    ParsedRepoInfo,
    SkillDescriptor,
    SkillDiscoveryResult,
)


class SkillService:
    """High-level API used by UI or command callers."""

    def __init__(
        self,
        client: GitHubClient | None = None,
        installer: SkillInstaller | None = None,
    ) -> None:
        self.client = client or GitHubClient()
        self.installer = installer or SkillInstaller()

    def parse_repo(self, source_url: str) -> ParsedRepoInfo:
        return self.client.parse_repo_url(source_url)

    def list_installable_skills(
        self,
        source_url: str,
        ref: str | None = None,
    ) -> SkillDiscoveryResult:
        repo = self.parse_repo(source_url)
        if ref:
            repo.ref = ref.strip()

        errors: list[str] = []
        with tempfile.TemporaryDirectory(prefix="codex_skill_forge_") as temp_dir:
            temp_root = Path(temp_dir)
            archive_path = self.client.download_archive(repo, temp_root)
            extracted = self.client.extract_archive(archive_path, temp_root)
            skills = self.client.list_skills(repo, extracted)
            if repo.scope_path:
                scope_root = extracted / repo.scope_path
                if not scope_root.exists():
                    errors.append(f"Scope path does not exist: {repo.scope_path}")
                    skills = ()
            return SkillDiscoveryResult(
                source=repo,
                skills=skills,
                errors=tuple(errors),
                snapshot_ref=repo.ref,
            )

    def install_skills(
        self,
        source_url: str,
        selected_skill_names: Iterable[str] | None = None,
        overwrite: bool = False,
        ref: str | None = None,
        target_root: str | Path | None = None,
    ) -> InstallResult:
        repo = self.parse_repo(source_url)
        if ref:
            repo.ref = ref.strip()

        requested = tuple(self._normalize_skill_selector(item) for item in (selected_skill_names or ()))
        with tempfile.TemporaryDirectory(prefix="codex_skill_forge_") as temp_dir:
            temp_root = Path(temp_dir)
            archive_path = self.client.download_archive(repo, temp_root)
            extracted = self.client.extract_archive(archive_path, temp_root)
            discovered = tuple(self.client.list_skills(repo, extracted))
            if not discovered:
                raise GitHubDownloadError(
                    "No SKILL.md directories found in the selected repository scope."
                )

            selected = self._resolve_selection(discovered, requested)
            if not selected:
                raise GitHubDownloadError(
                    f"None of requested skill names were found: {', '.join(requested)}"
                )

            plan = InstallPlan(
                source=repo,
                selected_skills=selected,
                requested=selected_skill_names_as_tuple(
                    requested or tuple(item.identifier for item in selected)
                ),
                snapshot_ref=repo.ref,
                temporary_root=str(extracted),
                target_root=str(Path(target_root) if target_root else self.installer.target_root()),
                overwrite_allowed=overwrite,
            )
            return self.installer.install_plan(plan)

    def _resolve_selection(
        self,
        discovered: tuple[SkillDescriptor, ...],
        requested: tuple[str, ...],
    ) -> tuple[SkillDescriptor, ...]:
        if not requested:
            return discovered

        by_name: dict[str, SkillDescriptor | None] = {}
        for skill in discovered:
            for key in {
                skill.identifier,
                skill.display_name,
                skill.destination_name,
                skill.relative_path,
            }:
                if not key:
                    continue
                normalized = key.lower()
                if normalized in by_name:
                    by_name[normalized] = None
                else:
                    by_name[normalized] = skill

        result: list[SkillDescriptor] = []
        seen: set[str] = set()
        selected_destinations: set[str] = set()
        for requested_name in requested:
            if requested_name not in by_name:
                continue
            skill = by_name[requested_name]
            if skill is None:
                raise DuplicateSkillError(
                    f"Ambiguous skill selector '{requested_name}'. Use a unique path."
                )
            if skill.destination_name in selected_destinations:
                raise DuplicateSkillError(
                    f"Multiple selected skills would install to '{skill.destination_name}'."
                )
            if skill.identifier not in seen:
                seen.add(skill.identifier)
                selected_destinations.add(skill.destination_name)
                result.append(skill)
        return tuple(result)

    @staticmethod
    def _normalize_skill_selector(name: str) -> str:
        return name.strip().strip("/").replace("\\", "/").lower()


def selected_skill_names_as_tuple(selected: tuple[str, ...]) -> tuple[str, ...]:
    return tuple(selected)
