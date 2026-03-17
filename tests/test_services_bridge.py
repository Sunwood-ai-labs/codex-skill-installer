from pathlib import Path

from codex_skill_forge.models import (
    InstallResult,
    InstallStatus,
    ParsedRepoInfo,
    SkillDescriptor,
    SkillDiscoveryResult,
    SkillInstallEntry,
)
from codex_skill_forge.services import SkillInstallerService
from codex_skill_forge.viewmodels import SkillCandidate


class _CoreStub:
    def __init__(self) -> None:
        self.installer = type("InstallerStub", (), {"target_root": lambda self: Path("C:/stub")})()

    def list_installable_skills(self, repository_url: str, ref: str | None = None):
        source = ParsedRepoInfo("owner", "repo", ref or "main", "", repository_url)
        return SkillDiscoveryResult(
            source=source,
            skills=(
                SkillDescriptor(
                    relative_path="skills/demo",
                    destination_name="demo",
                    manifest_path="skills/demo/SKILL.md",
                ),
            ),
            errors=(),
            snapshot_ref=source.ref,
        )

    def install_skills(
        self,
        repository_url: str,
        selected_skill_names,
        overwrite: bool = False,
        ref: str | None = None,
        target_root: str | Path | None = None,
    ) -> InstallResult:
        source = ParsedRepoInfo("owner", "repo", ref or "main", "", repository_url)
        entry = SkillInstallEntry(
            skill_identifier="skills/demo",
            source_path="skills/demo",
            destination=str(Path(target_root or ".") / "demo"),
            status=InstallStatus.INSTALLED,
            message="installed",
        )
        return InstallResult(
            source=source,
            snapshot_ref=source.ref,
            target_root=str(target_root or "."),
            requested=tuple(selected_skill_names),
            installed=(entry,),
            skipped=(),
            failed=(),
        )


def test_bridge_maps_core_results_to_viewmodel_result() -> None:
    service = SkillInstallerService(core=_CoreStub())
    candidate = SkillCandidate(name="demo", path="skills/demo")

    result = service.install_skills(
        repository_url="https://github.com/owner/repo",
        candidates=[candidate],
        destination=Path("C:/skills"),
        overwrite=False,
        ref="main",
    )

    assert result.ok is True
    assert len(result.outcomes) == 1
    assert result.outcomes[0].candidate.path == "skills/demo"


def test_bridge_detect_skills_raises_when_core_returns_only_errors() -> None:
    class _ErrorCore(_CoreStub):
        def list_installable_skills(self, repository_url: str, ref: str | None = None):
            source = ParsedRepoInfo("owner", "repo", ref or "main", "", repository_url)
            return SkillDiscoveryResult(
                source=source,
                skills=(),
                errors=("Scope path does not exist",),
                snapshot_ref=source.ref,
            )

    service = SkillInstallerService(core=_ErrorCore())

    try:
        service.detect_skills("https://github.com/owner/repo")
    except ValueError as exc:
        assert "Scope path does not exist" in str(exc)
    else:
        raise AssertionError("Expected ValueError when discovery only returns errors.")
