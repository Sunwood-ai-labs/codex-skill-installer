import type { UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useId, useRef, useState } from "react";

import {
  fetchDefaultDestination,
  inspectRepository,
  installSkills,
  pickDestination,
} from "./lib/api";
import type {
  AppDialog,
  InstallOutcome,
  LogEntry,
  LogTone,
  SkillCandidate,
  SkillInstallResult,
} from "./lib/types";

const READY_TEXT = "Ready.";

type FieldErrors = {
  destination: string | null;
  repositoryUrl: string | null;
};

type WindowAction = (appWindow: ReturnType<typeof getCurrentWindow>) => Promise<void>;

function nextLogId(): number {
  return Date.now() + Math.floor(Math.random() * 1000);
}

function isGithubUrl(value: string): boolean {
  try {
    const parsed = new URL(value.trim());
    return (
      (parsed.protocol === "https:" || parsed.protocol === "http:") &&
      (parsed.hostname === "github.com" || parsed.hostname === "www.github.com") &&
      parsed.pathname.replaceAll("/", "").length > 0
    );
  } catch {
    return false;
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  return "Unexpected error.";
}

function formatOutcome(outcome: InstallOutcome): string {
  const statusLabel = outcome.installed ? "installed" : outcome.skipped ? "skipped" : "failed";
  return `${statusLabel.padEnd(8, " ")} ${outcome.candidate.name} -> ${outcome.destination} (${outcome.message})`;
}

function validateInputFields(repositoryUrl: string, destination: string): FieldErrors {
  return {
    repositoryUrl: !repositoryUrl.trim()
      ? "Repository URL is required."
      : !isGithubUrl(repositoryUrl)
        ? "Repository URL must be a valid GitHub URL."
        : null,
    destination: !destination.trim() ? "Destination directory is required." : null,
  };
}

function hasErrors(errors: FieldErrors): boolean {
  return Boolean(errors.repositoryUrl || errors.destination);
}

function hasTauriWindowApi(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export default function App() {
  const canManageWindow = hasTauriWindowApi();
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [refValue, setRefValue] = useState("");
  const [destination, setDestination] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState(READY_TEXT);
  const [candidates, setCandidates] = useState<SkillCandidate[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [result, setResult] = useState<SkillInstallResult | null>(null);
  const [dialog, setDialog] = useState<AppDialog | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({
    destination: null,
    repositoryUrl: null,
  });
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: nextLogId(),
      tone: "info",
      text: READY_TEXT,
    },
  ]);
  const [liveMessage, setLiveMessage] = useState(READY_TEXT);
  const [isWindowMaximized, setIsWindowMaximized] = useState(false);
  const logViewportRef = useRef<HTMLDivElement | null>(null);
  const dialogCardRef = useRef<HTMLDivElement | null>(null);
  const dialogCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogTriggerRef = useRef<HTMLElement | null>(null);
  const urlInputRef = useRef<HTMLInputElement | null>(null);
  const destinationInputRef = useRef<HTMLInputElement | null>(null);
  const repositoryHelpId = useId();
  const destinationHelpId = useId();

  function appendLog(tone: LogTone, text: string): void {
    setLogs((current) => [
      ...current,
      {
        id: nextLogId(),
        tone,
        text,
      },
    ]);
    setLiveMessage(text);
  }

  function focusFirstErroredField(errors: FieldErrors): void {
    if (errors.repositoryUrl) {
      urlInputRef.current?.focus();
      return;
    }
    if (errors.destination) {
      destinationInputRef.current?.focus();
    }
  }

  function clearFieldError(field: keyof FieldErrors): void {
    setFieldErrors((current) => {
      if (!current[field]) {
        return current;
      }
      return {
        ...current,
        [field]: null,
      };
    });
  }

  function handleFieldValidation(field: keyof FieldErrors, nextValue: string): void {
    const nextErrors = validateInputFields(
      field === "repositoryUrl" ? nextValue : repositoryUrl,
      field === "destination" ? nextValue : destination,
    );

    setFieldErrors((current) => ({
      ...current,
      [field]: nextErrors[field],
    }));
  }

  function closeDialog(): void {
    setDialog(null);
  }

  function openDialog(tone: AppDialog["tone"], title: string, message: string): void {
    dialogTriggerRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    setDialog({ tone, title, message });
    setLiveMessage(`${title}. ${message}`);
  }

  async function runWindowAction(action: WindowAction): Promise<void> {
    if (!canManageWindow) {
      return;
    }

    try {
      await action(getCurrentWindow());
    } catch (error) {
      const message = toErrorMessage(error);
      appendLog("error", `[ERROR] ${message}`);
      openDialog("error", "Window controls failed", message);
    }
  }

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const defaultDestination = await fetchDefaultDestination();
        if (!cancelled) {
          setDestination(defaultDestination);
        }
      } catch (error) {
        const message = toErrorMessage(error);
        if (!cancelled) {
          appendLog("warn", `[WARN] ${message}`);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const viewport = logViewportRef.current;
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    if (!dialog) {
      dialogTriggerRef.current?.focus();
      return;
    }

    const dialogNode = dialogCardRef.current;
    const closeButton = dialogCloseButtonRef.current;
    closeButton?.focus();

    function handleKeydown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDialog();
        return;
      }

      if (event.key !== "Tab" || !dialogNode) {
        return;
      }

      const focusable = dialogNode.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("keydown", handleKeydown);
    };
  }, [dialog]);

  useEffect(() => {
    if (!canManageWindow) {
      setIsWindowMaximized(false);
      return;
    }

    let isMounted = true;
    let unlisten: UnlistenFn | null = null;
    const appWindow = getCurrentWindow();

    async function updateWindowMaximizedState(): Promise<void> {
      try {
        const maximized = await appWindow.isMaximized();
        if (isMounted) {
          setIsWindowMaximized(maximized);
        }
      } catch (error) {
        if (isMounted) {
          appendLog("warn", `[WARN] Window state could not be read. ${toErrorMessage(error)}`);
        }
      }
    }

    void (async () => {
      await updateWindowMaximizedState();
      unlisten = await appWindow.onResized(() => {
        void updateWindowMaximizedState();
      });
    })();

    return () => {
      isMounted = false;
      unlisten?.();
    };
  }, [canManageWindow]);

  async function handleBrowse(): Promise<void> {
    try {
      const picked = await pickDestination();
      if (picked) {
        setDestination(picked);
        handleFieldValidation("destination", picked);
      }
    } catch (error) {
      const message = toErrorMessage(error);
      appendLog("error", `[ERROR] ${message}`);
      openDialog("error", "Folder picker failed", message);
    }
  }

  async function handleInspect(): Promise<void> {
    const nextErrors = validateInputFields(repositoryUrl, destination);
    setFieldErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      appendLog(
        "warn",
        `[WARN] ${[nextErrors.repositoryUrl, nextErrors.destination].filter(Boolean).join("; ")}`,
      );
      focusFirstErroredField(nextErrors);
      return;
    }

    setBusy(true);
    setBusyLabel("Inspecting repository...");
    setLiveMessage("Inspecting repository.");
    setResult(null);
    appendLog("info", "Inspecting repository...");

    try {
      const inspectResult = await inspectRepository(repositoryUrl, refValue);
      setCandidates(inspectResult.candidates);
      setSelectedPaths([]);

      for (const line of inspectResult.logs) {
        appendLog("info", `[INFO] ${line}`);
      }

      if (inspectResult.candidates.length === 0) {
        appendLog("info", "No candidates detected.");
      } else {
        appendLog("info", "Review the detected skills, then choose which ones to install.");
      }
    } catch (error) {
      const message = toErrorMessage(error);
      appendLog("error", `[ERROR] ${message}`);
      openDialog("error", "Inspection failed", message);
    } finally {
      setBusy(false);
      setBusyLabel(READY_TEXT);
    }
  }

  async function handleInstall(): Promise<void> {
    const chosen = selectedPaths.filter((path) => path.trim().length > 0);
    if (chosen.length === 0) {
      appendLog("warn", "No skill candidates selected.");
      openDialog("warn", "Nothing selected", "Please select at least one candidate.");
      return;
    }

    const nextErrors = validateInputFields(repositoryUrl, destination);
    setFieldErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      appendLog(
        "warn",
        `[WARN] ${[nextErrors.repositoryUrl, nextErrors.destination].filter(Boolean).join("; ")}`,
      );
      focusFirstErroredField(nextErrors);
      return;
    }

    setBusy(true);
    setBusyLabel("Installing selected skills...");
    setLiveMessage("Installing selected skills.");
    appendLog("info", "Installing selected skills...");

    try {
      const installResult = await installSkills(
        repositoryUrl,
        chosen,
        destination,
        overwrite,
        refValue,
      );
      setResult(installResult);
      appendLog(installResult.ok ? "success" : "error", installResult.summary);

      for (const outcome of installResult.outcomes) {
        appendLog(
          outcome.installed ? "success" : outcome.skipped ? "warn" : "error",
          formatOutcome(outcome),
        );
      }

      for (const line of installResult.logs) {
        appendLog("info", `[INFO] ${line}`);
      }

      if (installResult.ok) {
        openDialog("info", "Install completed", installResult.summary);
      } else {
        openDialog("error", "Install failed", installResult.summary);
      }
    } catch (error) {
      const message = toErrorMessage(error);
      appendLog("error", `[ERROR] ${message}`);
      openDialog("error", "Install failed", message);
    } finally {
      setBusy(false);
      setBusyLabel(READY_TEXT);
    }
  }

  function clearCandidates(): void {
    setCandidates([]);
    setSelectedPaths([]);
    setResult(null);
    appendLog("info", "Candidate list cleared.");
  }

  function toggleCandidate(path: string): void {
    setSelectedPaths((current) => {
      if (current.includes(path)) {
        return current.filter((item) => item !== path);
      }
      return [...current, path];
    });
  }

  function selectAllCandidates(): void {
    setSelectedPaths(candidates.map((candidate) => candidate.path));
  }

  function clearSelectedCandidates(): void {
    setSelectedPaths([]);
  }

  function handleWindowControlClick(action: WindowAction): void {
    void runWindowAction(action);
  }

  const selectedCount = selectedPaths.length;
  const latestStatus = busy ? busyLabel : logs.at(-1)?.text ?? READY_TEXT;
  const repositoryUrlInvalid = Boolean(fieldErrors.repositoryUrl);
  const destinationInvalid = Boolean(fieldErrors.destination);
  const hasCandidateSelection = candidates.length > 0;
  const maximizeControlLabel = isWindowMaximized ? "Restore window" : "Maximize window";
  const titlebarStatusLabel = busy ? "Working" : isWindowMaximized ? "Maximized" : "Ready";
  const titlebarSelectionLabel = hasCandidateSelection
    ? `${selectedCount} of ${candidates.length} selected`
    : "Inspect to build a shortlist";

  return (
    <div className="app-shell">
      <header className="custom-titlebar">
        <div className="custom-titlebar-inner">
          <div className="titlebar-drag-region" data-tauri-drag-region role="presentation">
            <div className="titlebar-brand" data-tauri-drag-region>
              <span className="titlebar-emblem" aria-hidden="true" data-tauri-drag-region>
                CS
              </span>
              <div className="titlebar-label-group" data-tauri-drag-region>
                <p className="titlebar-title" data-tauri-drag-region>
                  Codex Skill Installer
                </p>
                <p className="titlebar-subtitle" data-tauri-drag-region>
                  Tauri 2 desktop workspace
                </p>
              </div>
            </div>

            <div className="titlebar-metrics" data-tauri-drag-region>
              <span className={`titlebar-chip ${busy ? "titlebar-chip-busy" : ""}`} data-tauri-drag-region>
                {titlebarStatusLabel}
              </span>
              <span className="titlebar-chip titlebar-chip-muted" data-tauri-drag-region>
                {titlebarSelectionLabel}
              </span>
            </div>
          </div>

          <div aria-label="Window controls" className="titlebar-controls" role="toolbar">
            <button
              aria-label="Minimize window"
              className="titlebar-control"
              disabled={!canManageWindow}
              onClick={() => {
                handleWindowControlClick(async (appWindow) => {
                  await appWindow.minimize();
                });
              }}
              title="Minimize"
              type="button"
            >
              <span className="window-control-glyph window-control-glyph-minimize" aria-hidden="true" />
            </button>
            <button
              aria-label={maximizeControlLabel}
              className="titlebar-control"
              disabled={!canManageWindow}
              onClick={() => {
                handleWindowControlClick(async (appWindow) => {
                  await appWindow.toggleMaximize();
                });
              }}
              title={maximizeControlLabel}
              type="button"
            >
              <span
                className={
                  isWindowMaximized
                    ? "window-control-glyph window-control-glyph-restore"
                    : "window-control-glyph window-control-glyph-maximize"
                }
                aria-hidden="true"
              />
            </button>
            <button
              aria-label="Close window"
              className="titlebar-control titlebar-control-close"
              disabled={!canManageWindow}
              onClick={() => {
                handleWindowControlClick(async (appWindow) => {
                  await appWindow.close();
                });
              }}
              title="Close"
              type="button"
            >
              <span className="window-control-glyph window-control-glyph-close" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {liveMessage}
      </div>
      <div aria-live="assertive" aria-atomic="true" className="sr-only">
        {dialog ? `${dialog.title}. ${dialog.message}` : ""}
      </div>

      <div className="background-glow background-glow-left" />
      <div className="background-glow background-glow-right" />

      <main className="workspace">
        <section className="hero-panel">
          <div className="hero-copy">
            <p className="eyebrow">Tauri 2 Desktop</p>
            <h1>Codex Skill Installer</h1>
            <p className="hero-text">
              Inspect GitHub skill repositories, review the `SKILL.md` folders you actually want,
              and install them into your local Codex profile without hauling an Electron-sized
              runtime around.
            </p>
          </div>

          <div className="hero-status">
            <span className={`status-pill ${busy ? "status-pill-busy" : ""}`}>
              {busy ? "Working" : "Ready"}
            </span>
            <p>{latestStatus}</p>
            <span className="status-caption">
              {hasCandidateSelection
                ? `${selectedCount} of ${candidates.length} candidates selected`
                : "Inspect a repository to review candidates before install"}
            </span>
          </div>
        </section>

        <section className="grid-layout">
          <section className="panel form-panel">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">Repository Input</p>
                <h2>Source & install target</h2>
              </div>
              <span className="panel-tag">WebView + Rust core</span>
            </div>

            <label className="field" htmlFor="repository-url">
              <span>GitHub URL</span>
              <input
                aria-describedby={repositoryHelpId}
                aria-invalid={repositoryUrlInvalid}
                className={repositoryUrlInvalid ? "field-input field-input-invalid" : "field-input"}
                disabled={busy}
                id="repository-url"
                onBlur={() => handleFieldValidation("repositoryUrl", repositoryUrl)}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setRepositoryUrl(nextValue);
                  clearFieldError("repositoryUrl");
                }}
                placeholder="https://github.com/owner/repo or /tree/ref/path"
                ref={urlInputRef}
                type="url"
                value={repositoryUrl}
              />
              <span className={repositoryUrlInvalid ? "field-help field-help-error" : "field-help"} id={repositoryHelpId}>
                {fieldErrors.repositoryUrl ?? "Repository, tree, and blob URLs are supported."}
              </span>
            </label>

            <label className="field" htmlFor="ref-override">
              <span>Ref override</span>
              <input
                className="field-input"
                disabled={busy}
                id="ref-override"
                onChange={(event) => setRefValue(event.target.value)}
                placeholder="optional override"
                type="text"
                value={refValue}
              />
              <span className="field-help">Use this when you want to inspect a different branch or tag.</span>
            </label>

            <div className="field">
              <label htmlFor="destination-input">
                <span>Install to</span>
              </label>
              <div className="destination-row">
                <input
                  aria-describedby={destinationHelpId}
                  aria-invalid={destinationInvalid}
                  className={destinationInvalid ? "field-input field-input-invalid" : "field-input"}
                  disabled={busy}
                  id="destination-input"
                  onBlur={() => handleFieldValidation("destination", destination)}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setDestination(nextValue);
                    clearFieldError("destination");
                  }}
                  placeholder="Choose a Codex skills directory"
                  ref={destinationInputRef}
                  type="text"
                  value={destination}
                />
                <button
                  className="ghost-button"
                  disabled={busy}
                  onClick={() => {
                    void handleBrowse();
                  }}
                  type="button"
                >
                  Browse
                </button>
              </div>
              <span className={destinationInvalid ? "field-help field-help-error" : "field-help"} id={destinationHelpId}>
                {fieldErrors.destination ?? "Defaults to your Codex skills directory when available."}
              </span>
            </div>

            <label className="checkbox-field">
              <input
                checked={overwrite}
                disabled={busy}
                onChange={(event) => setOverwrite(event.target.checked)}
                type="checkbox"
              />
              <span>Overwrite existing skill folders</span>
            </label>

            <div className="button-row">
              <button
                className="primary-button"
                disabled={busy}
                onClick={() => {
                  void handleInspect();
                }}
                type="button"
              >
                Inspect
              </button>
              <button
                className="secondary-action-button"
                disabled={busy || selectedCount === 0}
                onClick={() => {
                  void handleInstall();
                }}
                type="button"
              >
                Install selected
              </button>
              <button
                className="ghost-button"
                disabled={busy}
                onClick={clearCandidates}
                type="button"
              >
                Clear
              </button>
            </div>
          </section>

          <section className="panel candidate-panel">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">Detected Skills</p>
                <h2>Candidate checklist</h2>
              </div>
              <div className="mini-stats">
                <span>{candidates.length} found</span>
                <span>{selectedCount} selected</span>
              </div>
            </div>

            {candidates.length === 0 ? (
              <div className="empty-state">
                <p>No candidates yet.</p>
                <span>Run inspect to scan the repository for `SKILL.md` folders.</span>
              </div>
            ) : (
              <>
                <div className="candidate-toolbar">
                  <p>Review the list first, then choose only the skills you want to install.</p>
                  <div className="candidate-toolbar-actions">
                    <button
                      className="ghost-button candidate-toolbar-button"
                      disabled={busy}
                      onClick={selectAllCandidates}
                      type="button"
                    >
                      Select all
                    </button>
                    <button
                      className="ghost-button candidate-toolbar-button"
                      disabled={busy || selectedCount === 0}
                      onClick={clearSelectedCandidates}
                      type="button"
                    >
                      Clear selection
                    </button>
                  </div>
                </div>
                <ul className="candidate-list">
                  {candidates.map((candidate) => {
                    const checked = selectedPaths.includes(candidate.path);
                    return (
                      <li className="candidate-card" key={candidate.path}>
                        <label className="candidate-toggle">
                          <input
                            checked={checked}
                            disabled={busy}
                            onChange={() => toggleCandidate(candidate.path)}
                            type="checkbox"
                          />
                          <div className="candidate-copy">
                            <strong>{candidate.name}</strong>
                            <code className="candidate-path">{candidate.path}</code>
                            {candidate.description ? (
                              <span className="candidate-description">{candidate.description}</span>
                            ) : null}
                          </div>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </section>

          <section className="panel log-panel">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">Status Feed</p>
                <h2>Logs & outcomes</h2>
              </div>
              {result ? (
                <div className="mini-stats">
                  <span>{result.installedCount} installed</span>
                  <span>{result.skippedCount} skipped</span>
                  <span>{result.failedCount} failed</span>
                </div>
              ) : null}
            </div>

            <div
              aria-live="polite"
              aria-busy={busy}
              className="log-viewport"
              ref={logViewportRef}
              role="status"
            >
              {logs.map((entry) => (
                <div className={`log-line log-${entry.tone}`} key={entry.id}>
                  {entry.text}
                </div>
              ))}
            </div>
          </section>
        </section>
      </main>

      {dialog ? (
        <div className="dialog-backdrop" role="presentation">
          <div
            aria-describedby="dialog-message"
            aria-labelledby="dialog-title"
            aria-modal="true"
            className={`dialog-card dialog-${dialog.tone}`}
            ref={dialogCardRef}
            role="dialog"
            tabIndex={-1}
          >
            <p className="panel-kicker">{dialog.tone.toUpperCase()}</p>
            <h3 id="dialog-title">{dialog.title}</h3>
            <p id="dialog-message">{dialog.message}</p>
            <div className="dialog-actions">
              <button
                className="ghost-button"
                onClick={closeDialog}
                type="button"
              >
                Dismiss
              </button>
              <button
                className="primary-button"
                onClick={closeDialog}
                ref={dialogCloseButtonRef}
                type="button"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
