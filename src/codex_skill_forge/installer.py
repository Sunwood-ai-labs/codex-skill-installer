"""Installer for copying selected skill directories into CODEX skills directory."""

from __future__ import annotations

import shutil
from pathlib import Path

from .models import InstallPlan, InstallResult, InstallStatus, SkillDescriptor, SkillInstallEntry
from .paths import get_codex_skills_dir


class InstallSkippedError(Exception):
    """Raised for expected skip paths that should not count as failures."""


class SkillInstaller:
    """Install selected skills from an extracted repository snapshot."""

    def __init__(self) -> None:
        self._target_root = self._resolve_target_root()

    def _resolve_target_root(self) -> Path:
        return get_codex_skills_dir()

    def target_root(self) -> Path:
        return self._target_root

    def install_plan(self, plan: InstallPlan) -> InstallResult:
        installed: list[SkillInstallEntry] = []
        skipped: list[SkillInstallEntry] = []
        failed: list[SkillInstallEntry] = []
        errors: list[str] = []

        target_root = Path(plan.target_root)
        target_root.mkdir(parents=True, exist_ok=True)

        for skill in plan.selected_skills:
            try:
                destination = self._install_one(plan, skill)
                installed.append(
                    SkillInstallEntry(
                        skill_identifier=skill.identifier,
                        source_path=skill.source_path,
                        destination=str(destination),
                        status=InstallStatus.INSTALLED,
                    )
                )
            except InstallSkippedError as exc:
                skipped.append(
                    SkillInstallEntry(
                        skill_identifier=skill.identifier,
                        source_path=skill.source_path,
                        destination=str(target_root / skill.destination_name),
                        status=InstallStatus.SKIPPED,
                        message=str(exc),
                    )
                )
            except Exception as exc:
                failed.append(
                    SkillInstallEntry(
                        skill_identifier=skill.identifier,
                        source_path=skill.source_path,
                        destination=str(target_root / skill.destination_name),
                        status=InstallStatus.FAILED,
                        message=str(exc),
                    )
                )
                errors.append(f"{skill.identifier}: {exc}")

        return InstallResult(
            source=plan.source,
            snapshot_ref=plan.snapshot_ref,
            target_root=str(target_root),
            requested=plan.requested,
            installed=tuple(installed),
            skipped=tuple(skipped),
            failed=tuple(failed),
            errors=tuple(errors),
        )

    def _install_one(self, plan: InstallPlan, skill: SkillDescriptor) -> Path:
        source_dir = Path(plan.temporary_root)
        if skill.relative_path and skill.relative_path != ".":
            source_dir = source_dir / skill.relative_path
        manifest = source_dir / "SKILL.md"
        if not manifest.is_file():
            raise FileNotFoundError(f"SKILL.md not found in {source_dir}")

        destination = Path(plan.target_root) / skill.destination_name
        if destination.exists():
            if not plan.overwrite_allowed:
                raise InstallSkippedError("Destination already exists and overwrite is false.")
            if not destination.is_dir():
                raise FileExistsError(f"Existing path is not a directory: {destination}")
            shutil.rmtree(destination)

        shutil.copytree(source_dir, destination, dirs_exist_ok=False)
        return destination
