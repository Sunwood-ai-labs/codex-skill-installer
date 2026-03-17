"""GitHub repository parsing and archive helpers for skill discovery."""

from __future__ import annotations

import tarfile
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path, PurePosixPath, PureWindowsPath
from typing import Iterable

from .models import GitHubDownloadError, GitHubUrlError, ParsedRepoInfo, SkillDescriptor


GITHUB_HOSTS = {"github.com", "www.github.com"}
SKILL_FILE = "SKILL.md"
DEFAULT_REF = "HEAD"


class GitHubClient:
    """Small GitHub client that pulls public repository archives."""

    def __init__(self, timeout_seconds: float = 30.0) -> None:
        self.timeout_seconds = timeout_seconds

    def parse_repo_url(self, source_url: str) -> ParsedRepoInfo:
        """Parse GitHub repo/tree/blob URLs into a normalized repository model."""
        parsed = urllib.parse.urlparse(source_url.strip())
        if parsed.scheme not in {"http", "https"}:
            raise GitHubUrlError("URL must be http(s).")

        if parsed.hostname is None or parsed.hostname.lower() not in GITHUB_HOSTS:
            raise GitHubUrlError("Only github.com repository URLs are supported.")

        segments = [seg for seg in parsed.path.split("/") if seg]
        if len(segments) < 2:
            raise GitHubUrlError("URL must include owner and repository.")

        owner = segments[0]
        repo = segments[1]
        if repo.endswith(".git"):
            repo = repo[:-4]

        ref = DEFAULT_REF
        scope_parts: list[str] = []

        if len(segments) >= 3:
            segment_kind = segments[2]
            if segment_kind == "tree":
                if len(segments) < 4:
                    raise GitHubUrlError(
                        "tree URL format must be /tree/{ref} or /tree/{ref}/{path}."
                    )
                ref = urllib.parse.unquote(segments[3]) or DEFAULT_REF
                scope_parts = [
                    urllib.parse.unquote(part) for part in segments[4:] if part
                ]
            elif segment_kind in {"blob", "raw"}:
                if len(segments) < 5:
                    raise GitHubUrlError(
                        "blob/raw URL format must be /blob/{ref}/{path}."
                    )
                ref = urllib.parse.unquote(segments[3]) or DEFAULT_REF
                scope_parts = [
                    urllib.parse.unquote(part) for part in segments[4:] if part
                ]
                if scope_parts and scope_parts[-1].lower() == SKILL_FILE.lower():
                    scope_parts = scope_parts[:-1]

        scope = "/".join(part.strip("/") for part in scope_parts)
        return ParsedRepoInfo(
            owner=owner,
            repo=repo,
            ref=ref or DEFAULT_REF,
            scope_path=scope,
            source_url=source_url.strip(),
        )

    def list_archive_urls(self, repo: ParsedRepoInfo) -> tuple[str, ...]:
        """Return archive download fallback options for this repository/ref."""
        safe_ref = urllib.parse.quote(repo.ref, safe="")
        archive_urls = (
            f"https://api.github.com/repos/{repo.owner}/{repo.repo}/tarball/{safe_ref}",
            f"https://api.github.com/repos/{repo.owner}/{repo.repo}/tarball",
            f"https://github.com/{repo.owner}/{repo.repo}/archive/{safe_ref}.zip",
            f"https://github.com/{repo.owner}/{repo.repo}/archive/refs/heads/{safe_ref}.zip",
        )
        seen: set[str] = set()
        output: list[str] = []
        for url in archive_urls:
            if url not in seen:
                seen.add(url)
                output.append(url)
        return tuple(output)

    def download_archive(
        self,
        repo: ParsedRepoInfo,
        destination_dir: Path | None = None,
    ) -> Path:
        """Download an archive from GitHub to a temporary file."""
        destination_dir = destination_dir or Path(tempfile.gettempdir())
        destination_dir.mkdir(parents=True, exist_ok=True)
        request_headers = {
            "User-Agent": "codex-skill-installer",
            "Accept": "application/octet-stream",
        }
        last_error: Exception | None = None

        for url in self.list_archive_urls(repo):
            request = urllib.request.Request(url, headers=request_headers)
            try:
                with urllib.request.urlopen(request, timeout=self.timeout_seconds) as response:
                    if response.status != 200:
                        raise GitHubDownloadError(
                            f"GitHub returned HTTP {response.status} for {url}"
                        )

                    suffix = ".zip" if ".zip" in url else ".tar.gz"
                    with tempfile.NamedTemporaryFile(
                        suffix=suffix,
                        delete=False,
                        dir=destination_dir,
                    ) as file_handle:
                        while True:
                            chunk = response.read(1024 * 256)
                            if not chunk:
                                break
                            file_handle.write(chunk)
                        return Path(file_handle.name)
            except (GitHubDownloadError, urllib.error.URLError, TimeoutError, OSError) as exc:
                last_error = exc
                continue

        if last_error is not None:
            raise GitHubDownloadError(f"Failed to download archive: {last_error}") from last_error
        raise GitHubDownloadError("Failed to download repository archive.")

    def _iter_archive_members(self, archive_path: Path) -> Iterable[str]:
        if zipfile.is_zipfile(archive_path):
            with zipfile.ZipFile(archive_path) as zip_file:
                for name in zip_file.namelist():
                    if self._is_safe_archive_path(name):
                        yield name
        elif tarfile.is_tarfile(archive_path):
            with tarfile.open(archive_path, "r:*") as tar_file:
                for member in tar_file.getmembers():
                    if self._is_safe_archive_path(member.name):
                        yield member.name
        else:
            raise GitHubDownloadError("Downloaded file is not a zip/tar archive.")

    def extract_archive(self, archive_path: Path, destination: Path) -> Path:
        """Extract a GitHub archive and return the single repository root directory."""
        destination.mkdir(parents=True, exist_ok=True)
        if zipfile.is_zipfile(archive_path):
            with zipfile.ZipFile(archive_path) as zip_file:
                self._extract_zip_with_check(zip_file, destination)
        elif tarfile.is_tarfile(archive_path):
            with tarfile.open(archive_path, "r:*") as tar_file:
                self._extract_tar_with_check(tar_file, destination)
        else:
            raise GitHubDownloadError("Downloaded file is not a valid archive.")

        roots = set()
        for member in self._iter_archive_members(archive_path):
            first = member.split("/", 1)[0]
            if first:
                roots.add(first)
        if len(roots) != 1:
            raise GitHubDownloadError(
                "Unexpected archive layout: expected a single top-level directory."
            )
        return destination / next(iter(roots))

    def _extract_zip_with_check(self, zip_file: zipfile.ZipFile, destination: Path) -> None:
        for info in zip_file.infolist():
            if not self._is_safe_archive_path(info.filename):
                continue
            zip_file.extract(info, destination)

    def _extract_tar_with_check(self, tar_file: tarfile.TarFile, destination: Path) -> None:
        for member in tar_file.getmembers():
            if not self._is_safe_archive_path(member.name):
                raise GitHubDownloadError(f"Archive contains an unsafe path: {member.name}")
            if not (member.isdir() or member.isfile()):
                raise GitHubDownloadError(
                    f"Archive contains an unsupported tar member type: {member.name}"
                )
            tar_file.extract(member, destination, filter="data")

    def _is_safe_archive_path(self, name: str) -> bool:
        if not name:
            return False
        normalized = name.replace("\\", "/")
        posix_path = PurePosixPath(normalized)
        windows_path = PureWindowsPath(name)
        if posix_path.is_absolute() or windows_path.is_absolute():
            return False
        parts = posix_path.parts
        if not parts:
            return False
        if ":" in parts[0]:
            return False
        return ".." not in parts

    def list_skills(
        self,
        repo: ParsedRepoInfo,
        extracted_root: Path,
    ) -> tuple[SkillDescriptor, ...]:
        """Find skill directories by looking for SKILL.md files."""
        scan_root = extracted_root / PurePosixPath(repo.scope_path) if repo.scope_path else extracted_root
        if not scan_root.exists() or not scan_root.is_dir():
            return ()

        seen: dict[str, SkillDescriptor] = {}
        for manifest in scan_root.rglob(SKILL_FILE):
            if not manifest.is_file() or manifest.name.lower() != SKILL_FILE.lower():
                continue

            parent = manifest.parent
            relative_parent = parent.relative_to(extracted_root)
            relative_path = str(relative_parent).replace("\\", "/")
            relative_path = "." if relative_path in {"", "."} else relative_path
            destination_name = repo.repo if relative_path == "." else parent.name
            seen[relative_path] = SkillDescriptor(
                relative_path=relative_path,
                destination_name=destination_name,
                manifest_path=str(manifest.relative_to(extracted_root)).replace("\\", "/"),
                has_subskills=False,
            )

        return tuple(sorted(seen.values(), key=lambda item: item.relative_path.lower()))
