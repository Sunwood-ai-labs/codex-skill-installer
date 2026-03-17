"""PySide6 GUI implementation for the skill installer."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Optional

from PySide6.QtCore import QObject, Qt, QThread, Signal, Slot
from PySide6.QtGui import QAction
from PySide6.QtWidgets import (
    QAbstractItemView,
    QApplication,
    QCheckBox,
    QFileDialog,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QListWidget,
    QListWidgetItem,
    QMainWindow,
    QMessageBox,
    QPlainTextEdit,
    QPushButton,
    QVBoxLayout,
    QWidget,
)

from .viewmodels import (
    InstallOutcome,
    NoService,
    SkillCandidate,
    SkillInspectResult,
    SkillInstallResult,
    SkillInstallerService,
    SkillInstallerViewModel,
)
from .paths import get_codex_skills_dir


@dataclass(frozen=True)
class _GuiState:
    repository_url: str = ""
    ref: str = ""
    destination: str = ""
    overwrite: bool = False


class _Worker(QObject):
    started = Signal(str)
    succeeded = Signal(object)
    failed = Signal(str)

    def __init__(self, title: str, func: Callable[[], object]) -> None:
        super().__init__()
        self._title = title
        self._func = func

    @Slot()
    def run(self) -> None:
        try:
            self.started.emit(self._title)
            self.succeeded.emit(self._func())
        except Exception as exc:
            self.failed.emit(str(exc))


class InstallerWindow(QMainWindow):
    """Main window for skill installation workflows."""

    def __init__(self, service: Optional[SkillInstallerService] = None) -> None:
        super().__init__()
        self._model = SkillInstallerViewModel(service or NoService())
        self._active_jobs: list[tuple[QThread, _Worker]] = []
        self._busy = False
        self._state = _GuiState(destination=str(get_codex_skills_dir()))
        self._candidate_checkboxes: list[QListWidgetItem] = []

        self.setWindowTitle("Codex Skill Installer")
        self.resize(860, 640)
        self._build_ui()
        self._append_log("Ready.")

    def _build_ui(self) -> None:
        root = QWidget()
        self.setCentralWidget(root)

        root_layout = QVBoxLayout(root)
        root_layout.setContentsMargins(14, 14, 14, 14)
        root_layout.setSpacing(10)

        input_layout = QHBoxLayout()
        input_layout.setSpacing(8)
        input_layout.addWidget(QLabel("GitHub URL:"))
        self.url_input = QLineEdit()
        self.url_input.setPlaceholderText("https://github.com/owner/repo or /tree/ref/path")
        input_layout.addWidget(self.url_input, stretch=1)
        input_layout.addWidget(QLabel("Ref:"))
        self.ref_input = QLineEdit()
        self.ref_input.setPlaceholderText("optional override")
        self.ref_input.setMaximumWidth(220)
        input_layout.addWidget(self.ref_input)
        root_layout.addLayout(input_layout)

        destination_layout = QHBoxLayout()
        destination_layout.setSpacing(8)
        destination_layout.addWidget(QLabel("Install to:"))
        self.destination_input = QLineEdit(self._state.destination)
        self.browse_btn = QPushButton("Browse...")
        self.browse_btn.clicked.connect(self._choose_destination)
        destination_layout.addWidget(self.destination_input, stretch=1)
        destination_layout.addWidget(self.browse_btn)
        root_layout.addLayout(destination_layout)

        self.overwrite_checkbox = QCheckBox("Overwrite existing skill folders")
        root_layout.addWidget(self.overwrite_checkbox)

        action_layout = QHBoxLayout()
        self.inspect_btn = QPushButton("Inspect")
        self.install_btn = QPushButton("Install selected")
        self.clear_btn = QPushButton("Clear")
        self.install_btn.setEnabled(False)
        action_layout.addWidget(self.inspect_btn)
        action_layout.addWidget(self.install_btn)
        action_layout.addWidget(self.clear_btn)
        root_layout.addLayout(action_layout)

        self.inspect_btn.clicked.connect(self._handle_inspect)
        self.install_btn.clicked.connect(self._handle_install)
        self.clear_btn.clicked.connect(self._clear_candidates)

        self.candidate_list = QListWidget()
        self.candidate_list.setSelectionMode(QAbstractItemView.NoSelection)
        self.candidate_list.itemChanged.connect(self._update_install_enabled)
        root_layout.addWidget(QLabel("Detected skill candidates"))
        root_layout.addWidget(self.candidate_list, stretch=2)

        self.log_output = QPlainTextEdit()
        self.log_output.setReadOnly(True)
        self.log_output.setMinimumHeight(190)
        root_layout.addWidget(QLabel("Status and logs"))
        root_layout.addWidget(self.log_output)

        file_menu = self.menuBar().addMenu("&File")
        exit_action = QAction("Exit", self)
        exit_action.triggered.connect(self.close)
        file_menu.addAction(exit_action)

        self.statusBar()
        self.url_input.textChanged.connect(self._on_state_change)
        self.ref_input.textChanged.connect(self._on_state_change)
        self.destination_input.textChanged.connect(self._on_state_change)
        self.overwrite_checkbox.stateChanged.connect(self._on_state_change)

    def _on_state_change(self) -> None:
        self._state = _GuiState(
            repository_url=self.url_input.text().strip(),
            ref=self.ref_input.text().strip(),
            destination=self.destination_input.text().strip(),
            overwrite=self.overwrite_checkbox.isChecked(),
        )

    def _choose_destination(self) -> None:
        folder = QFileDialog.getExistingDirectory(self, "Select install destination")
        if folder:
            self.destination_input.setText(folder)
            self._on_state_change()

    def _append_log(self, message: str) -> None:
        self.log_output.appendPlainText(message)

    def _snapshot_state(self) -> _GuiState:
        return _GuiState(
            repository_url=self.url_input.text().strip(),
            ref=self.ref_input.text().strip(),
            destination=self.destination_input.text().strip(),
            overwrite=self.overwrite_checkbox.isChecked(),
        )

    def _toggle_controls(self, enabled: bool) -> None:
        self._busy = not enabled
        self.inspect_btn.setEnabled(enabled)
        self.clear_btn.setEnabled(enabled)
        self.install_btn.setEnabled(enabled and self._has_checked_candidate())
        self.url_input.setEnabled(enabled)
        self.ref_input.setEnabled(enabled)
        self.destination_input.setEnabled(enabled)
        self.browse_btn.setEnabled(enabled)
        self.overwrite_checkbox.setEnabled(enabled)
        self.candidate_list.setEnabled(enabled)

    def _has_checked_candidate(self) -> bool:
        return any(item.checkState() == Qt.Checked for item in self._candidate_checkboxes)

    def _run_async(
        self,
        title: str,
        worker_fn: Callable[[], object],
        on_done: Callable[[object], None],
    ) -> None:
        self._append_log(title)
        self._toggle_controls(False)

        thread = QThread(self)
        worker = _Worker(title=title, func=worker_fn)
        worker.moveToThread(thread)
        self._active_jobs.append((thread, worker))

        def cleanup() -> None:
            try:
                self._active_jobs.remove((thread, worker))
            except ValueError:
                pass
            if thread.isRunning():
                thread.quit()
                thread.wait(2000)

        def handle_finish(result: object) -> None:
            self._append_log("Task completed.")
            on_done(result)
            cleanup()
            self._toggle_controls(True)

        def handle_error(message: str) -> None:
            self._append_log(f"[ERROR] {message}")
            QMessageBox.critical(self, "Task failed", message)
            cleanup()
            self._toggle_controls(True)

        worker.started.connect(lambda msg: self.statusBar().showMessage(msg, 1500))
        worker.succeeded.connect(handle_finish)
        worker.failed.connect(handle_error)
        thread.started.connect(worker.run)
        thread.finished.connect(worker.deleteLater)
        thread.finished.connect(thread.deleteLater)
        thread.start()

    def _handle_inspect(self) -> None:
        state = self._snapshot_state()
        issues = SkillInstallerViewModel.validate_inputs(
            state.repository_url,
            Path(state.destination),
        )
        if issues:
            self._append_log(f"[WARN] {'; '.join(issues)}")
            return

        def do_inspect() -> SkillInspectResult:
            return self._model.inspect(state.repository_url, ref=state.ref or None)

        def on_done(result: object) -> None:
            if not isinstance(result, SkillInspectResult):
                self._append_log("Unexpected inspect result.")
                return
            if not result.ok:
                self._append_log(f"[ERROR] {result.error_message or 'Unknown error'}")
                QMessageBox.critical(self, "Inspection failed", result.error_message or "Unknown error")
                return

            self._update_candidates(result.candidates)
            for line in result.logs:
                self._append_log(f"[INFO] {line}")
            if not result.candidates:
                self._append_log("No candidates detected.")

        self._run_async("Inspecting repository...", do_inspect, on_done)

    def _handle_install(self) -> None:
        selected = self._get_selected_candidates()
        if not selected:
            self._append_log("No skill candidates selected.")
            QMessageBox.warning(self, "Nothing selected", "Please select at least one candidate.")
            return

        state = self._snapshot_state()
        issues = SkillInstallerViewModel.validate_inputs(
            state.repository_url,
            Path(state.destination),
        )
        if issues:
            self._append_log(f"[WARN] {'; '.join(issues)}")
            return

        def do_install() -> SkillInstallResult:
            return self._model.install(
                repository_url=state.repository_url,
                candidates=selected,
                destination=Path(state.destination),
                overwrite=state.overwrite,
                ref=state.ref or None,
            )

        def on_done(result: object) -> None:
            if not isinstance(result, SkillInstallResult):
                self._append_log("Unexpected install result.")
                return
            if result.ok:
                self._append_log(result.summary)
                QMessageBox.information(self, "Install completed", result.summary)
            else:
                self._append_log(f"[ERROR] {result.error_message or 'Unknown error'}")
                QMessageBox.critical(self, "Install failed", result.error_message or "Unknown error")
            self._append_install_logs(result)

        self._run_async("Installing selected skills...", do_install, on_done)

    def _append_install_logs(self, result: SkillInstallResult) -> None:
        for outcome in result.outcomes:
            self._append_log(self._format_outcome(outcome))
        for line in result.logs:
            self._append_log(f"[INFO] {line}")

    def _format_outcome(self, outcome: InstallOutcome) -> str:
        return (
            f"{outcome.status_label:8} {outcome.candidate.name} -> "
            f"{outcome.destination} ({outcome.message})"
        )

    def _clear_candidates(self) -> None:
        self.candidate_list.clear()
        self._candidate_checkboxes = []
        self._update_install_enabled()
        self._append_log("Candidate list cleared.")

    def _update_candidates(self, candidates: list[SkillCandidate]) -> None:
        self.candidate_list.blockSignals(True)
        self.candidate_list.clear()
        self._candidate_checkboxes = []
        for candidate in candidates:
            label = f"{candidate.name} - {candidate.path}"
            if candidate.description:
                label = f"{label} ({candidate.description})"
            item = QListWidgetItem(label)
            item.setFlags(item.flags() | Qt.ItemIsUserCheckable)
            item.setCheckState(Qt.Checked)
            item.setData(Qt.UserRole, candidate)
            self.candidate_list.addItem(item)
            self._candidate_checkboxes.append(item)
        self.candidate_list.blockSignals(False)
        self._update_install_enabled()

    def _update_install_enabled(self) -> None:
        self.install_btn.setEnabled((not self._busy) and self._has_checked_candidate())

    def _get_selected_candidates(self) -> list[SkillCandidate]:
        selected: list[SkillCandidate] = []
        for item in self._candidate_checkboxes:
            if item.checkState() != Qt.Checked:
                continue
            candidate = item.data(Qt.UserRole)
            if isinstance(candidate, SkillCandidate):
                selected.append(candidate)
        return selected


def run_installer(service: Optional[SkillInstallerService] = None) -> None:
    """Create and run the GUI event loop."""
    app = QApplication.instance() or QApplication([])
    window = InstallerWindow(service=service)
    window.show()
    app.exec()
