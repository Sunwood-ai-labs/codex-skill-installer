from pathlib import Path

from codex_skill_forge.github_client import GitHubClient


def test_parse_repo_url_supports_blob_skill_file() -> None:
    client = GitHubClient()

    parsed = client.parse_repo_url(
        "https://github.com/openai/skills/blob/main/skills/.curated/example/SKILL.md"
    )

    assert parsed.owner == "openai"
    assert parsed.repo == "skills"
    assert parsed.ref == "main"
    assert parsed.scope_path == "skills/.curated/example"


def test_list_skills_uses_relative_paths_and_folder_names(tmp_path: Path) -> None:
    repo_root = tmp_path / "repo"
    skill_dir = repo_root / "skills" / ".curated" / "sample-skill"
    skill_dir.mkdir(parents=True)
    (skill_dir / "SKILL.md").write_text("# sample\n", encoding="utf-8")

    client = GitHubClient()
    parsed = client.parse_repo_url("https://github.com/openai/skills")
    skills = client.list_skills(parsed, repo_root)

    assert len(skills) == 1
    assert skills[0].relative_path == "skills/.curated/sample-skill"
    assert skills[0].destination_name == "sample-skill"
