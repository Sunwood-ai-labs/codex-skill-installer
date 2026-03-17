from pathlib import Path

from codex_skill_forge.installer import SkillInstaller
from codex_skill_forge.paths import get_codex_skills_dir


def test_codex_skills_dir_prefers_codex_home(monkeypatch: object, tmp_path: Path) -> None:
    override_root = tmp_path / "codex-home"
    monkeypatch.setenv("CODEX_HOME", str(override_root))
    monkeypatch.setenv("USERPROFILE", str(tmp_path / "ignored-userprofile"))
    monkeypatch.setenv("HOME", str(tmp_path / "ignored-home"))

    assert get_codex_skills_dir() == override_root / "skills"


def test_codex_skills_dir_falls_back_to_windows_home(monkeypatch: object) -> None:
    monkeypatch.delenv("CODEX_HOME", raising=False)
    windows_home = "C:/Users/codex-user"
    monkeypatch.setenv("USERPROFILE", windows_home)
    monkeypatch.setenv("HOME", "C:/Fallback/Home")

    assert get_codex_skills_dir(platform="win32") == Path(windows_home) / ".codex" / "skills"


def test_codex_skills_dir_falls_back_to_unix_home(monkeypatch: object) -> None:
    monkeypatch.delenv("CODEX_HOME", raising=False)
    unix_home = "/home/codex-user"
    monkeypatch.setenv("HOME", unix_home)
    monkeypatch.delenv("USERPROFILE", raising=False)

    assert get_codex_skills_dir(platform="linux") == Path(unix_home) / ".codex" / "skills"


def test_installer_uses_shared_codex_skills_directory(monkeypatch: object, tmp_path: Path) -> None:
    override_root = tmp_path / "shared-codex"
    monkeypatch.setenv("CODEX_HOME", str(override_root))

    installer = SkillInstaller()

    assert installer.target_root() == override_root / "skills"
