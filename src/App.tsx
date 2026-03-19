import type { UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

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

type WorkspaceTab = "setup" | "candidates" | "logs";

type WindowAction = (appWindow: ReturnType<typeof getCurrentWindow>) => Promise<void>;

const MAX_LOG_ENTRIES = 250;

const WORKFLOW_STEPS = [
  {
    code: "01",
    title: "Inspect the archive",
    detail: "Pull the GitHub repository and find every folder that actually ships with SKILL.md.",
  },
  {
    code: "02",
    title: "Mark the shortlist",
    detail: "Review each candidate instead of mass-installing everything the repository happens to contain.",
  },
  {
    code: "03",
    title: "Install to your vault",
    detail: "Write the chosen skills into your Codex profile and keep an explicit session log of the run.",
  },
] as const;

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
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("setup");
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: nextLogId(),
      tone: "info",
      text: READY_TEXT,
    },
  ]);
  const [liveMessage, setLiveMessage] = useState(READY_TEXT);
  const [unreadLogCount, setUnreadLogCount] = useState(0);
  const [isWindowMaximized, setIsWindowMaximized] = useState(false);
  const logViewportRef = useRef<HTMLDivElement | null>(null);
  const dialogCardRef = useRef<HTMLDivElement | null>(null);
  const dialogCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogTriggerRef = useRef<HTMLElement | null>(null);
  const urlInputRef = useRef<HTMLInputElement | null>(null);
  const destinationInputRef = useRef<HTMLInputElement | null>(null);
  const setupTabRef = useRef<HTMLButtonElement | null>(null);
  const candidateTabRef = useRef<HTMLButtonElement | null>(null);
  const logTabRef = useRef<HTMLButtonElement | null>(null);
  const repositoryHelpId = useId();
  const destinationHelpId = useId();

  function switchWorkspaceTab(nextTab: WorkspaceTab, options?: { focusTab?: boolean }): void {
    setActiveTab(nextTab);
    if (nextTab === "logs") {
      setUnreadLogCount(0);
    }

    if (options?.focusTab) {
      window.requestAnimationFrame(() => {
        const nextButton = nextTab === "setup"
          ? setupTabRef.current
          : nextTab === "candidates"
            ? candidateTabRef.current
            : logTabRef.current;
        nextButton?.focus();
      });
    }
  }

  function appendLog(tone: LogTone, text: string): void {
    setLogs((current) => {
      const nextEntry = {
        id: nextLogId(),
        tone,
        text,
      };

      return [...current.slice(-(MAX_LOG_ENTRIES - 1)), nextEntry];
    });
    setLiveMessage(text);
    setUnreadLogCount((current) => (activeTab === "logs" ? 0 : current + 1));
  }

  function invalidateWorkspaceResults(): void {
    setCandidates((current) => (current.length === 0 ? current : []));
    setSelectedPaths((current) => (current.length === 0 ? current : []));
    setResult((current) => (current ? null : current));
    switchWorkspaceTab("setup");
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
    if (tone === "error") {
      switchWorkspaceTab("logs");
    }
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
    if (activeTab === "logs") {
      setUnreadLogCount(0);
    }
  }, [activeTab]);

  useEffect(() => {
    if (!dialog) {
      const fallbackTarget = dialogTriggerRef.current ?? urlInputRef.current ?? destinationInputRef.current;
      fallbackTarget?.focus();
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
        if (picked !== destination) {
          invalidateWorkspaceResults();
        }
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
        switchWorkspaceTab("setup");
      } else {
        appendLog("info", "Review the detected skills, then choose which ones to install.");
        switchWorkspaceTab("candidates");
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
    switchWorkspaceTab("logs");
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
    switchWorkspaceTab("setup");
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

  function handleWorkspaceTabKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>): void {
    if (
      event.key !== "ArrowLeft" &&
      event.key !== "ArrowRight" &&
      event.key !== "Home" &&
      event.key !== "End"
    ) {
      return;
    }

    event.preventDefault();

    const order: WorkspaceTab[] = ["setup", "candidates", "logs"];
    const currentIndex = order.indexOf(activeTab);

    if (event.key === "Home") {
      switchWorkspaceTab(order[0], { focusTab: true });
      return;
    }

    if (event.key === "End") {
      switchWorkspaceTab(order[order.length - 1], { focusTab: true });
      return;
    }

    const nextIndex = event.key === "ArrowRight"
      ? (currentIndex + 1) % order.length
      : (currentIndex - 1 + order.length) % order.length;

    switchWorkspaceTab(order[nextIndex], { focusTab: true });
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
    ? `${selectedCount} marked for install`
    : "No shortlist yet";
  const sessionSummary = result ? result.summary : latestStatus;
  const installLedgerLabel = result
    ? `${result.installedCount} installed / ${result.skippedCount} skipped / ${result.failedCount} failed`
    : "No install run in this session";
  const destinationSummary = destination.trim() || "Resolving default target";
  const setupHint = "Lock the source and destination first. Once those are stable, move to the shortlist tab.";
  const shortlistHint = candidates.length === 0
    ? "Run inspect to build the shortlist."
    : selectedCount === 0
      ? "Review each detected folder before you queue it."
      : `${selectedCount} folders are marked and ready for install review.`;
  const transcriptHint = busy
    ? "The ledger is active. Keep this view open while the installer writes."
    : result
      ? "Audit the final outcomes before you close the session."
      : "The ledger stays quiet until inspection or install starts.";
  const workspaceTitle = activeTab === "setup"
    ? "Setup desk"
    : activeTab === "candidates"
      ? "Shortlist review"
      : "Session transcript";
  const workspaceCopy = activeTab === "setup"
    ? "Desktop flow starts here. Confirm the repository and destination before you open the shortlist."
    : activeTab === "candidates"
      ? "Keep the list tight and deliberate. The shortlist should feel curated, not dumped onto one long page."
      : "Treat the ledger as a control room. Every inspect and install event stays in reach while you work.";

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
                  Editorial vault control
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
        <section className="workspace-header">
          <div>
            <p className="eyebrow">Field Manual 01</p>
            <h1>{workspaceTitle}</h1>
            <p className="workspace-header-copy">{workspaceCopy}</p>
          </div>
          <div className="workspace-header-metrics">
            <span>{busy ? "Working" : "Ready"}</span>
            <span>{candidates.length} found</span>
            <span>{selectedCount} marked</span>
            <span>{logs.length} ledger lines</span>
          </div>
        </section>

        <div aria-label="Workspace sections" className="app-tabbar" role="tablist">
          <button
            aria-controls="workspace-panel-setup"
            aria-selected={activeTab === "setup"}
            className="app-tab"
            id="workspace-tab-setup"
            onClick={() => switchWorkspaceTab("setup")}
            onKeyDown={handleWorkspaceTabKeyDown}
            ref={setupTabRef}
            role="tab"
            tabIndex={activeTab === "setup" ? 0 : -1}
            type="button"
          >
            <span>Setup</span>
            <strong>01</strong>
          </button>
          <button
            aria-controls="workspace-panel-candidates"
            aria-selected={activeTab === "candidates"}
            className="app-tab"
            id="workspace-tab-candidates"
            onClick={() => switchWorkspaceTab("candidates")}
            onKeyDown={handleWorkspaceTabKeyDown}
            ref={candidateTabRef}
            role="tab"
            tabIndex={activeTab === "candidates" ? 0 : -1}
            type="button"
          >
            <span>Shortlist</span>
            <strong>{candidates.length}</strong>
          </button>
          <button
            aria-controls="workspace-panel-logs"
            aria-selected={activeTab === "logs"}
            className="app-tab"
            id="workspace-tab-logs"
            onClick={() => switchWorkspaceTab("logs")}
            onKeyDown={handleWorkspaceTabKeyDown}
            ref={logTabRef}
            role="tab"
            tabIndex={activeTab === "logs" ? 0 : -1}
            type="button"
          >
            <span>Transcript</span>
            <strong>{unreadLogCount > 0 ? `+${Math.min(unreadLogCount, 99)}` : logs.length}</strong>
          </button>
        </div>

        <section
          aria-labelledby="workspace-tab-setup"
          className="panel setup-panel workspace-panel"
          hidden={activeTab !== "setup"}
          id="workspace-panel-setup"
          role="tabpanel"
        >
          <div className="setup-grid">
            <section className="setup-copy">
              <div className="hero-banner">
                <span className="hero-stamp">Curated desktop installer</span>
                <span className="panel-tag">Source / destination</span>
              </div>
              <h2>Curate skills before they enter your local vault.</h2>
              <p className="panel-intro">
                This app is not a bulk importer. Lock the repository and destination first, inspect
                the archive next, then move to the shortlist tab only after the source is stable.
              </p>
              <div className="hero-rundown">
                {WORKFLOW_STEPS.map((step) => (
                  <article className="rundown-card" key={step.code}>
                    <span className="rundown-index">{step.code}</span>
                    <div>
                      <h3>{step.title}</h3>
                      <p>{step.detail}</p>
                    </div>
                  </article>
                ))}
              </div>
              <div className="workspace-focus-note">
                <span>Setup note</span>
                <p>{setupHint}</p>
              </div>
            </section>

            <div className="hero-status setup-status">
              <div className="status-header">
                <span className={`status-pill ${busy ? "status-pill-busy" : ""}`}>
                  {busy ? "Working" : "Ready"}
                </span>
                <p className="status-kicker">Session ledger</p>
              </div>
              <p className="status-lead">{sessionSummary}</p>
              <div className="status-grid">
                <div className="status-metric">
                  <span>Candidates</span>
                  <strong>{candidates.length}</strong>
                </div>
                <div className="status-metric">
                  <span>Marked</span>
                  <strong>{selectedCount}</strong>
                </div>
                <div className="status-metric">
                  <span>Window</span>
                  <strong>{isWindowMaximized ? "max" : "std"}</strong>
                </div>
              </div>
              <dl className="status-notes">
                <div>
                  <dt>Runtime</dt>
                  <dd>Tauri 2 with a Rust host</dd>
                </div>
                <div>
                  <dt>Target</dt>
                  <dd>{destinationSummary}</dd>
                </div>
                <div>
                  <dt>Ledger</dt>
                  <dd>{installLedgerLabel}</dd>
                </div>
              </dl>
            </div>

            <section className="form-panel setup-form-panel">
              <div className="panel-heading">
                <div>
                  <p className="panel-kicker">Acquisition Desk</p>
                  <h2>Source repository & local target</h2>
                </div>
              </div>
              <p className="panel-intro">
                Start with a repository, tree, or blob URL. The installer will inspect the archive,
                expose only valid skill folders, and keep existing installs untouched unless you
                explicitly allow overwrite.
              </p>

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
                    if (nextValue !== repositoryUrl) {
                      invalidateWorkspaceResults();
                    }
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
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    if (nextValue !== refValue) {
                      invalidateWorkspaceResults();
                    }
                    setRefValue(nextValue);
                  }}
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
                      if (nextValue !== destination) {
                        invalidateWorkspaceResults();
                      }
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
          </div>
        </section>

        <section
          aria-labelledby="workspace-tab-candidates"
          className="panel candidate-panel workspace-panel"
          hidden={activeTab !== "candidates"}
          id="workspace-panel-candidates"
          role="tabpanel"
        >
              <div className="panel-heading">
                <div>
                  <p className="panel-kicker">Archive Review</p>
                  <h2>Candidate shortlist</h2>
                </div>
                <div className="mini-stats">
                  <span>{candidates.length} found</span>
                  <span>{selectedCount} selected</span>
                </div>
              </div>
              <p className="panel-intro">
                Treat this as a catalog table, not a download bucket. Review each folder, then mark
                the ones that deserve a place in your Codex profile.
              </p>
              <div className="workspace-focus-note">
                <span>Review mode</span>
                <p>{shortlistHint}</p>
              </div>

              <div className="candidate-stage">
                {candidates.length === 0 ? (
                  <div className="empty-state">
                    <p>Shortlist is empty.</p>
                    <span>Run inspect to scan the repository archive for folders that ship with `SKILL.md`.</span>
                  </div>
                ) : (
                  <>
                    <div className="candidate-toolbar">
                      <p>Inspect first, then mark only the candidates that belong in your vault.</p>
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
                      {candidates.map((candidate, index) => {
                        const checked = selectedPaths.includes(candidate.path);
                        return (
                          <li className={`candidate-card ${checked ? "candidate-card-selected" : ""}`} key={candidate.path}>
                            <label className="candidate-toggle">
                              <div className="candidate-index-rail">
                                <span className="candidate-index">{String(index + 1).padStart(2, "0")}</span>
                                <input
                                  checked={checked}
                                  disabled={busy}
                                  onChange={() => toggleCandidate(candidate.path)}
                                  type="checkbox"
                                />
                              </div>
                              <div className="candidate-copy">
                                <div className="candidate-header">
                                  <strong>{candidate.name}</strong>
                                  <span className="candidate-chip">{checked ? "Queued" : "Available"}</span>
                                </div>
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
              </div>
        </section>

        <section
          aria-labelledby="workspace-tab-logs"
          className="panel log-panel workspace-panel"
          hidden={activeTab !== "logs"}
          id="workspace-panel-logs"
          role="tabpanel"
        >
              <div className="panel-heading">
                <div>
                  <p className="panel-kicker">Session Transcript</p>
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
              <p className="panel-intro">
                Every inspection and install event is written into the ledger below so you can verify
                what happened without guessing.
              </p>
              <div className="workspace-focus-note workspace-focus-note-ledger">
                <span>Ledger focus</span>
                <p>{transcriptHint}</p>
              </div>

              <div className="log-stage">
                <div className="log-ledger">
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
                </div>
              </div>
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
