"""Application bootstrap for the GUI."""

from __future__ import annotations

from collections.abc import Callable
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .viewmodels import SkillInstallerService


def _bootstrap_default_service() -> SkillInstallerService | None:
    """Best-effort hook to connect the packaged service implementation."""
    try:
        from .services import SkillInstallerService as service_impl
    except ModuleNotFoundError:
        return None
    return service_impl()


def main(
    service_factory: Callable[[], SkillInstallerService] | None = None,
) -> None:
    """Launch the desktop app."""
    try:
        from .ui import run_installer
    except ModuleNotFoundError as exc:
        if exc.name == "PySide6":
            raise RuntimeError(
                "PySide6 is required to launch the GUI. Run `uv sync` first."
            ) from exc
        raise

    service = service_factory() if service_factory is not None else _bootstrap_default_service()
    run_installer(service=service)


if __name__ == "__main__":
    main()
