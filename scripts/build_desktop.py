#!/usr/bin/env python
"""Build native desktop executables with UV-backed PyInstaller."""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build platform-native desktop artifacts with PyInstaller.",
    )
    parser.add_argument(
        "--name",
        default="codex-skill-installer",
        help="Base application name used by PyInstaller.",
    )
    parser.add_argument(
        "--artifact-suffix",
        default=None,
        help="Optional suffix appended to the generated executable name.",
    )
    parser.add_argument(
        "--mode",
        choices=("onedir", "onefile"),
        default="onedir",
        help="PyInstaller output mode. onedir is the safest cross-platform default.",
    )
    parser.add_argument(
        "--output-dir",
        default="dist",
        help="PyInstaller output directory.",
    )
    parser.add_argument(
        "--work-dir",
        default=".pyinstaller",
        help="PyInstaller working directory.",
    )
    return parser.parse_args()


def _build_name(base: str, suffix: str | None) -> tuple[str, str]:
    effective = f"{base}-{suffix}" if suffix else base
    artifact_name = (
        f"{effective}.exe" if os.name == "nt" and not effective.lower().endswith(".exe") else effective
    )
    return effective, artifact_name


def _build_args(
    args: argparse.Namespace,
) -> tuple[list[str], Path, Path, Path]:
    package_name, artifact_name = _build_name(args.name, args.artifact_suffix)
    output_dir = Path(args.output_dir)
    work_dir = Path(args.work_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    work_dir.mkdir(parents=True, exist_ok=True)

    mode = "--onedir" if args.mode == "onedir" else "--onefile"
    pyinstaller_args = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--noconfirm",
        "--clean",
        "--paths",
        "src",
        "--name",
        package_name,
        "--distpath",
        str(output_dir),
        "--workpath",
        str(work_dir),
        "--specpath",
        str(work_dir / "spec"),
        "--hidden-import",
        "codex_skill_forge.ui",
        "--hidden-import",
        "codex_skill_forge.services",
        mode,
        "--windowed",
        "src/codex_skill_forge/__main__.py",
    ]
    return (
        pyinstaller_args,
        output_dir,
        Path(output_dir) / artifact_name,
        Path(output_dir) / package_name,
    )


def main() -> None:
    args = _parse_args()
    pyinstaller_args, output_dir, expected_file, expected_dir = _build_args(args)

    print(f"[build] running: {' '.join(pyinstaller_args)}")
    subprocess.run(pyinstaller_args, check=True)
    if args.mode == "onefile":
        if expected_file.exists():
            print(f"[build] produced: {expected_file}")
            return
        # PyInstaller onefile outputs a file directly under the dist directory.
        # Keep a fallback check to match any platform-specific filename produced.
        for candidate in output_dir.iterdir():
            if candidate.is_file() and candidate.name.startswith(
                f"{args.name}"
                if args.artifact_suffix is None
                else f"{args.name}-{args.artifact_suffix}"
            ):
                print(f"[build] produced: {candidate}")
                return
        raise FileNotFoundError(
            f"Expected onefile artifact was not found in {output_dir}."
        )

    # onedir mode produces a directory under dist/.
    if expected_dir.exists() and expected_dir.is_dir():
        print(f"[build] produced: {expected_dir}")
    elif expected_dir.exists():
        print(f"[build] produced: {expected_dir}")
    else:
        raise FileNotFoundError(f"Expected onedir artifact was not found in {output_dir}.")


if __name__ == "__main__":
    main()
