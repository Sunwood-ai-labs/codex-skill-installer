from pathlib import Path
from unittest.mock import patch

from codex_skill_forge.installer import SkillInstaller
from codex_skill_forge.models import InstallPlan, ParsedRepoInfo, SkillDescriptor


def test_install_overwrite_flow(tmp_path: Path) -> None:
    source_root = tmp_path / "source"
    skill_source = source_root / "example-skill"
    skill_source.mkdir(parents=True)
    (skill_source / "SKILL.md").write_text("# example\n", encoding="utf-8")

    target_root = tmp_path / "target"
    parsed = ParsedRepoInfo(
        owner="owner",
        repo="repo",
        ref="main",
        scope_path="",
        source_url="https://github.com/owner/repo",
    )
    descriptor = SkillDescriptor(
        relative_path="example-skill",
        destination_name="example-skill",
        manifest_path="example-skill/SKILL.md",
    )
    installer = SkillInstaller()

    first_plan = InstallPlan(
        source=parsed,
        selected_skills=(descriptor,),
        requested=("example-skill",),
        snapshot_ref="main",
        temporary_root=str(source_root),
        target_root=str(target_root),
        overwrite_allowed=False,
    )
    first = installer.install_plan(first_plan)
    assert first.status == "success"
    assert len(first.installed) == 1

    second = installer.install_plan(first_plan)
    assert second.status == "skipped"
    assert len(second.skipped) == 1

    overwrite_plan = InstallPlan(
        source=parsed,
        selected_skills=(descriptor,),
        requested=("example-skill",),
        snapshot_ref="main",
        temporary_root=str(source_root),
        target_root=str(target_root),
        overwrite_allowed=True,
    )
    third = installer.install_plan(overwrite_plan)
    assert third.status == "success"
    assert len(third.installed) == 1


def test_install_requires_skill_manifest(tmp_path: Path) -> None:
    source_root = tmp_path / "source"
    skill_source = source_root / "broken-skill"
    skill_source.mkdir(parents=True)

    target_root = tmp_path / "target"
    parsed = ParsedRepoInfo(
        owner="owner",
        repo="repo",
        ref="main",
        scope_path="",
        source_url="https://github.com/owner/repo",
    )
    descriptor = SkillDescriptor(
        relative_path="broken-skill",
        destination_name="broken-skill",
        manifest_path="broken-skill/SKILL.md",
    )
    installer = SkillInstaller()

    plan = InstallPlan(
        source=parsed,
        selected_skills=(descriptor,),
        requested=("broken-skill",),
        snapshot_ref="main",
        temporary_root=str(source_root),
        target_root=str(target_root),
        overwrite_allowed=False,
    )
    result = installer.install_plan(plan)

    assert result.status == "failed"
    assert len(result.failed) == 1


def test_install_reports_real_permission_errors_as_failed(tmp_path: Path) -> None:
    source_root = tmp_path / "source"
    skill_source = source_root / "protected-skill"
    skill_source.mkdir(parents=True)
    (skill_source / "SKILL.md").write_text("# protected\n", encoding="utf-8")

    target_root = tmp_path / "target"
    parsed = ParsedRepoInfo(
        owner="owner",
        repo="repo",
        ref="main",
        scope_path="",
        source_url="https://github.com/owner/repo",
    )
    descriptor = SkillDescriptor(
        relative_path="protected-skill",
        destination_name="protected-skill",
        manifest_path="protected-skill/SKILL.md",
    )
    installer = SkillInstaller()
    plan = InstallPlan(
        source=parsed,
        selected_skills=(descriptor,),
        requested=("protected-skill",),
        snapshot_ref="main",
        temporary_root=str(source_root),
        target_root=str(target_root),
        overwrite_allowed=False,
    )

    with patch("codex_skill_forge.installer.shutil.copytree", side_effect=PermissionError("ACL denied")):
        result = installer.install_plan(plan)

    assert result.status == "failed"
    assert len(result.failed) == 1
    assert len(result.skipped) == 0
