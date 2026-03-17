from pathlib import Path

from codex_skill_forge.viewmodels import SkillCandidate, SkillInstallerViewModel


def test_validate_inputs_allows_missing_destination_if_parent_exists(tmp_path: Path) -> None:
    missing_destination = tmp_path / "skills"

    issues = SkillInstallerViewModel.validate_inputs(
        "https://github.com/openai/skills",
        missing_destination,
    )

    assert issues == []


def test_validate_candidates_rejects_duplicate_destination_names() -> None:
    issues = SkillInstallerViewModel.validate_candidates(
        [
            SkillCandidate(name="demo", path="skills/demo-a"),
            SkillCandidate(name="demo", path="skills/demo-b"),
        ]
    )

    assert issues == ["Selected skills would install to duplicate names: demo"]
