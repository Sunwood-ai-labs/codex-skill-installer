"""Bridge the core installer service to the GUI-facing protocol."""

from __future__ import annotations

from pathlib import Path

from .service import SkillService as CoreSkillService
from .viewmodels import InstallOutcome, SkillCandidate, SkillInstallResult


class SkillInstallerService:
    """Concrete service implementation consumed by the PySide GUI."""

    def __init__(self, core: CoreSkillService | None = None) -> None:
        self._core = core or CoreSkillService()

    def default_destination(self) -> Path:
        return self._core.installer.target_root()

    def detect_skills(
        self,
        repository_url: str,
        ref: str | None = None,
    ) -> list[SkillCandidate]:
        discovery = self._core.list_installable_skills(repository_url, ref=ref)
        if discovery.errors and not discovery.skills:
            raise ValueError("; ".join(discovery.errors))
        return [
            SkillCandidate(
                name=item.destination_name,
                path=item.relative_path,
                skill_type="codex-skill",
                description=item.manifest_path,
                source_ref=discovery.snapshot_ref,
            )
            for item in discovery.skills
        ]

    def install_skills(
        self,
        repository_url: str,
        candidates: list[SkillCandidate],
        destination: Path,
        overwrite: bool = False,
        ref: str | None = None,
    ) -> SkillInstallResult:
        selected_paths = [candidate.path for candidate in candidates]
        core_result = self._core.install_skills(
            repository_url,
            selected_skill_names=selected_paths,
            overwrite=overwrite,
            ref=ref,
            target_root=destination,
        )
        candidate_map = {
            (candidate.path or candidate.name).lower(): candidate for candidate in candidates
        }
        outcomes: list[InstallOutcome] = []
        for entry in (*core_result.installed, *core_result.skipped, *core_result.failed):
            key = (entry.source_path or entry.skill_identifier).lower()
            candidate = candidate_map.get(
                key,
                SkillCandidate(name=entry.skill_identifier, path=entry.source_path),
            )
            outcomes.append(
                InstallOutcome(
                    candidate=candidate,
                    installed=entry.status.value == "installed",
                    skipped=entry.status.value == "skipped",
                    message=entry.message or entry.status.value,
                    destination=Path(entry.destination),
                    details=entry.as_dict(),
                )
            )

        logs = [
            f"Repository: {core_result.source.full_name}",
            f"Snapshot ref: {core_result.snapshot_ref}",
            f"Requested: {', '.join(core_result.requested) if core_result.requested else '(all)'}",
        ]
        if core_result.errors:
            logs.extend(core_result.errors)

        return SkillInstallResult(
            ok=not bool(core_result.failed),
            repository_url=repository_url,
            destination=destination,
            ref=core_result.snapshot_ref,
            overwrite=overwrite,
            candidates=candidates,
            outcomes=outcomes,
            error_message="; ".join(core_result.errors) if core_result.failed else None,
            logs=logs,
        )
