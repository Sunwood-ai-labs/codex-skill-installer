import os

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

from PySide6.QtCore import Qt
from PySide6.QtWidgets import QApplication

from codex_skill_forge.ui import InstallerWindow
from codex_skill_forge.viewmodels import SkillCandidate


def test_install_button_stays_disabled_while_busy() -> None:
    app = QApplication.instance() or QApplication([])
    window = InstallerWindow()
    window._update_candidates([SkillCandidate(name="demo", path="skills/demo")])

    item = window._candidate_checkboxes[0]
    assert window.install_btn.isEnabled() is True

    window._toggle_controls(False)
    assert window.candidate_list.isEnabled() is False
    assert window.install_btn.isEnabled() is False

    item.setCheckState(Qt.Unchecked)
    app.processEvents()
    item.setCheckState(Qt.Checked)
    app.processEvents()

    assert window.install_btn.isEnabled() is False

    window.close()
