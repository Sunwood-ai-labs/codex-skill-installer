from io import BytesIO
from pathlib import Path
import tarfile
import zipfile

import pytest

from codex_skill_forge.github_client import GitHubClient
from codex_skill_forge.models import DuplicateSkillError, GitHubDownloadError, ParsedRepoInfo, SkillDescriptor
from codex_skill_forge.service import SkillService


class _FakeResponse:
    def __init__(self, payload: bytes, status: int) -> None:
        self._stream = BytesIO(payload)
        self.status = status

    def read(self, size: int = -1) -> bytes:
        return self._stream.read(size)

    def __enter__(self) -> "_FakeResponse":
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        return None


def _zip_payload() -> bytes:
    stream = BytesIO()
    with zipfile.ZipFile(stream, "w") as zip_file:
        zip_file.writestr("repo-main/example/SKILL.md", "# example\n")
    return stream.getvalue()


def test_download_archive_tries_next_url_on_non_200(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = GitHubClient()
    repo = ParsedRepoInfo("owner", "repo", "main", "", "https://github.com/owner/repo")
    payload = _zip_payload()
    calls: list[str] = []

    def fake_urlopen(request, timeout=0):  # type: ignore[no-untyped-def]
        url = request.full_url
        calls.append(url)
        if len(calls) == 1:
            return _FakeResponse(b"", 500)
        return _FakeResponse(payload, 200)

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    archive_path = client.download_archive(repo, tmp_path)
    extracted_root = client.extract_archive(archive_path, tmp_path / "extract")

    assert len(calls) == 2
    assert extracted_root.exists()
    assert (extracted_root / "example" / "SKILL.md").exists()


def test_is_safe_archive_path_rejects_windows_traversal() -> None:
    client = GitHubClient()

    assert client._is_safe_archive_path("repo-main/example/SKILL.md") is True
    assert client._is_safe_archive_path("..\\evil") is False
    assert client._is_safe_archive_path("dir\\..\\ok") is False
    assert client._is_safe_archive_path("C:/temp/evil") is False


def test_service_rejects_duplicate_destination_selection() -> None:
    service = SkillService()
    discovered = (
        SkillDescriptor(
            relative_path="skills/demo-one",
            destination_name="demo",
            manifest_path="skills/demo-one/SKILL.md",
        ),
        SkillDescriptor(
            relative_path="skills/demo-two",
            destination_name="demo",
            manifest_path="skills/demo-two/SKILL.md",
        ),
    )

    with pytest.raises(DuplicateSkillError):
        service._resolve_selection(
            discovered,
            ("skills/demo-one", "skills/demo-two"),
        )


def test_extract_archive_rejects_tar_symlink(tmp_path: Path) -> None:
    tar_path = tmp_path / "repo.tar.gz"
    with tarfile.open(tar_path, "w:gz") as tar_file:
        dir_info = tarfile.TarInfo("repo-main/example")
        dir_info.type = tarfile.DIRTYPE
        tar_file.addfile(dir_info)

        file_bytes = b"# example\n"
        file_info = tarfile.TarInfo("repo-main/example/SKILL.md")
        file_info.size = len(file_bytes)
        tar_file.addfile(file_info, BytesIO(file_bytes))

        link_info = tarfile.TarInfo("repo-main/example/alias")
        link_info.type = tarfile.SYMTYPE
        link_info.linkname = "SKILL.md"
        tar_file.addfile(link_info)

    client = GitHubClient()
    with pytest.raises(GitHubDownloadError):
        client.extract_archive(tar_path, tmp_path / "extract")
