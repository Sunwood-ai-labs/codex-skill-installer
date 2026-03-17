"""Launcher module for GUI startup."""

from .app import main


def run() -> None:
    """Run the skill installer GUI."""
    main()


if __name__ == "__main__":
    run()
