import type { UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

import {
  fetchDefaultDestination,
  inspectRepository,
  installSkills,
  pickDestination,
} from "./lib/api";
import {
  detectInitialLocale,
  formatInstallSummary,
  formatOutcomeLine,
  formatTaggedLog,
  getUiCopy,
  localizeServiceMessage,
  persistLocale,
  resolveFieldError,
  toDisplayErrorMessage,
} from "./lib/i18n";
import type { BusyState, FieldErrorKey, Locale } from "./lib/i18n";
import type {
  AppDialog,
  LogEntry,
  LogTone,
  SkillCandidate,
  SkillInstallResult,
} from "./lib/types";

type FieldErrors = {
  destination: FieldErrorKey | null;
  repositoryUrl: FieldErrorKey | null;
};

type WorkspaceTab = "setup" | "candidates" | "logs";

type WindowAction = (appWindow: ReturnType<typeof getCurrentWindow>) => Promise<void>;

const MAX_LOG_ENTRIES = 250;
const INITIAL_LOCALE = detectInitialLocale();

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

function validateInputFields(repositoryUrl: string, destination: string): FieldErrors {
  return {
    repositoryUrl: !repositoryUrl.trim()
      ? "repositoryRequired"
      : !isGithubUrl(repositoryUrl)
        ? "repositoryInvalid"
        : null,
    destination: !destination.trim() ? "destinationRequired" : null,
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
  const [locale, setLocale] = useState<Locale>(INITIAL_LOCALE);
  const [busy, setBusy] = useState(false);
  const [busyState, setBusyState] = useState<BusyState>("ready");
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
      text: getUiCopy(INITIAL_LOCALE).logs.ready,
    },
  ]);
  const [liveMessage, setLiveMessage] = useState<string>(getUiCopy(INITIAL_LOCALE).logs.ready);
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
  const copy = getUiCopy(locale);
  const busyLabel = copy.busyState[busyState];

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

  function appendTaggedLog(tone: LogTone, message: string): void {
    const tagTone = tone === "success" ? "success" : tone;
    appendLog(tone, formatTaggedLog(locale, tagTone, message));
  }

  function setLanguage(nextLocale: Locale): void {
    setLocale(nextLocale);
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
    setLiveMessage(locale === "ja" ? `${title}。 ${message}` : `${title}. ${message}`);
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
      const message = toDisplayErrorMessage(error, locale);
      appendTaggedLog("error", message);
      openDialog("error", copy.windowControls.failedTitle, message);
    }
  }

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const defaultDestination = await fetchDefaultDestination(locale);
        if (!cancelled) {
          setDestination(defaultDestination);
        }
      } catch (error) {
        const message = toDisplayErrorMessage(error, locale);
        if (!cancelled) {
          appendTaggedLog("warn", message);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [locale]);

  useEffect(() => {
    persistLocale(locale);
  }, [locale]);

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
          appendTaggedLog(
            "warn",
            `${copy.logs.windowStateReadFailed} ${toDisplayErrorMessage(error, locale)}`,
          );
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
      const picked = await pickDestination(locale);
      if (picked) {
        if (picked !== destination) {
          invalidateWorkspaceResults();
        }
        setDestination(picked);
        handleFieldValidation("destination", picked);
      }
    } catch (error) {
      const message = toDisplayErrorMessage(error, locale);
      appendTaggedLog("error", message);
      openDialog("error", copy.dialogs.folderPickerFailed, message);
    }
  }

  async function handleInspect(): Promise<void> {
    const nextErrors = validateInputFields(repositoryUrl, destination);
    setFieldErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      const localizedErrors = [nextErrors.repositoryUrl, nextErrors.destination]
        .map((item) => resolveFieldError(locale, item))
        .filter((item): item is string => Boolean(item));
      appendTaggedLog("warn", localizedErrors.join(locale === "ja" ? " / " : "; "));
      focusFirstErroredField(nextErrors);
      return;
    }

    setBusy(true);
    setBusyState("inspecting");
    setLiveMessage(copy.busyState.inspecting);
    setResult(null);
    appendTaggedLog("info", copy.busyState.inspecting);

    try {
      const inspectResult = await inspectRepository(repositoryUrl, refValue, locale);
      setCandidates(inspectResult.candidates);
      setSelectedPaths([]);

      for (const line of inspectResult.logs) {
        appendTaggedLog("info", localizeServiceMessage(line, locale));
      }

      if (inspectResult.candidates.length === 0) {
        appendTaggedLog("info", copy.logs.noCandidates);
        switchWorkspaceTab("setup");
      } else {
        appendTaggedLog("info", copy.logs.reviewDetected);
        switchWorkspaceTab("candidates");
      }
    } catch (error) {
      const message = toDisplayErrorMessage(error, locale);
      appendTaggedLog("error", message);
      openDialog("error", copy.dialogs.inspectionFailed, message);
    } finally {
      setBusy(false);
      setBusyState("ready");
    }
  }

  async function handleInstall(): Promise<void> {
    const chosen = selectedPaths.filter((path) => path.trim().length > 0);
    if (chosen.length === 0) {
      appendTaggedLog("warn", copy.logs.noSelection);
      openDialog("warn", copy.dialogs.nothingSelected, copy.dialogs.pleaseSelectAtLeastOneCandidate);
      return;
    }

    const nextErrors = validateInputFields(repositoryUrl, destination);
    setFieldErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      const localizedErrors = [nextErrors.repositoryUrl, nextErrors.destination]
        .map((item) => resolveFieldError(locale, item))
        .filter((item): item is string => Boolean(item));
      appendTaggedLog("warn", localizedErrors.join(locale === "ja" ? " / " : "; "));
      focusFirstErroredField(nextErrors);
      return;
    }

    setBusy(true);
    setBusyState("installing");
    setLiveMessage(copy.busyState.installing);
    switchWorkspaceTab("logs");
    appendTaggedLog("info", copy.busyState.installing);

    try {
      const installResult = await installSkills(
        repositoryUrl,
        chosen,
        destination,
        overwrite,
        refValue,
        locale,
      );
      setResult(installResult);
      const localizedSummary = formatInstallSummary(locale, installResult);
      appendLog(installResult.ok ? "success" : "error", localizedSummary);

      for (const outcome of installResult.outcomes) {
        appendLog(
          outcome.installed ? "success" : outcome.skipped ? "warn" : "error",
          formatOutcomeLine(locale, outcome),
        );
      }

      for (const line of installResult.logs) {
        appendTaggedLog("info", localizeServiceMessage(line, locale));
      }

      if (installResult.ok) {
        openDialog("info", copy.dialogs.installCompleted, localizedSummary);
      } else {
        openDialog("error", copy.dialogs.installFailed, localizedSummary);
      }
    } catch (error) {
      const message = toDisplayErrorMessage(error, locale);
      appendTaggedLog("error", message);
      openDialog("error", copy.dialogs.installFailed, message);
    } finally {
      setBusy(false);
      setBusyState("ready");
    }
  }

  function clearCandidates(): void {
    setCandidates([]);
    setSelectedPaths([]);
    setResult(null);
    switchWorkspaceTab("setup");
    appendTaggedLog("info", copy.logs.candidateCleared);
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
  const repositoryUrlInvalid = Boolean(fieldErrors.repositoryUrl);
  const destinationInvalid = Boolean(fieldErrors.destination);
  const hasCandidateSelection = candidates.length > 0;
  const maximizeControlLabel = isWindowMaximized
    ? copy.windowControls.restore
    : copy.windowControls.maximize;
  const maximizeControlTitle = isWindowMaximized
    ? copy.windowControls.restoreTitle
    : copy.windowControls.maximizeTitle;
  const titlebarStatusLabel = busy ? busyLabel : isWindowMaximized ? copy.titlebar.maximized : copy.busyState.ready;
  const titlebarSelectionLabel = hasCandidateSelection
    ? copy.titlebar.selectionLabel(selectedCount)
    : copy.titlebar.noShortlist;
  const shortlistHint = candidates.length === 0
    ? copy.shortlist.hints.empty
    : selectedCount === 0
      ? copy.shortlist.hints.noneSelected
      : copy.shortlist.hints.selected(selectedCount);
  const transcriptHint = busy
    ? copy.transcript.hints.busy
    : result
      ? copy.transcript.hints.result
      : copy.transcript.hints.idle;
  const workspaceTitle = activeTab === "setup"
    ? copy.workspace.setupTitle
    : activeTab === "candidates"
      ? copy.workspace.candidatesTitle
      : copy.workspace.logsTitle;
  const workspaceCopy = activeTab === "setup"
    ? copy.workspace.setupCopy
    : activeTab === "candidates"
      ? copy.workspace.candidatesCopy
      : copy.workspace.logsCopy;

  return (
    <div className="app-shell" data-active-tab={activeTab}>
      <header className="custom-titlebar">
        <div className="custom-titlebar-inner">
          <div className="titlebar-drag-region" data-tauri-drag-region role="presentation">
            <div className="titlebar-brand" data-tauri-drag-region>
              <span className="titlebar-emblem" aria-hidden="true" data-tauri-drag-region>
                CS
              </span>
              <div className="titlebar-label-group" data-tauri-drag-region>
                <p className="titlebar-title" data-tauri-drag-region>
                  {copy.appTitle}
                </p>
                <p className="titlebar-subtitle" data-tauri-drag-region>
                  {copy.titlebarSubtitle}
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

          <div className="titlebar-utility">
            <div aria-label={copy.languageLabel} className="titlebar-locale-switch" role="group">
              <span className="titlebar-locale-caption">{copy.languageLabel}</span>
              {(["en", "ja"] as const).map((option) => (
                <button
                  aria-pressed={locale === option}
                  className={`titlebar-locale-button ${locale === option ? "titlebar-locale-button-active" : ""}`}
                  key={option}
                  onClick={() => setLanguage(option)}
                  type="button"
                >
                  {copy.localeOptions[option]}
                </button>
              ))}
            </div>

            <div aria-label={copy.windowControls.toolbar} className="titlebar-controls" role="toolbar">
            <button
              aria-label={copy.windowControls.minimize}
              className="titlebar-control"
              disabled={!canManageWindow}
              onClick={() => {
                handleWindowControlClick(async (appWindow) => {
                  await appWindow.minimize();
                });
              }}
              title={copy.windowControls.minimizeTitle}
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
              title={maximizeControlTitle}
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
              aria-label={copy.windowControls.close}
              className="titlebar-control titlebar-control-close"
              disabled={!canManageWindow}
              onClick={() => {
                handleWindowControlClick(async (appWindow) => {
                  await appWindow.close();
                });
              }}
              title={copy.windowControls.closeTitle}
              type="button"
            >
              <span className="window-control-glyph window-control-glyph-close" aria-hidden="true" />
            </button>
          </div>
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
            <p className="eyebrow">{copy.headerEyebrow}</p>
            <h1>{workspaceTitle}</h1>
            <p className="workspace-header-copy">{workspaceCopy}</p>
          </div>
          <div className="workspace-header-metrics">
            <span>{busyLabel}</span>
            <span>{copy.metrics.found(candidates.length)}</span>
            <span>{copy.metrics.marked(selectedCount)}</span>
            <span>{copy.metrics.ledgerLines(logs.length)}</span>
          </div>
        </section>

        <div aria-label={copy.workspaceSectionsLabel} className="app-tabbar" role="tablist">
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
            <span>{copy.tabs.setup}</span>
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
            <span>{copy.tabs.candidates}</span>
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
            <span>{copy.tabs.logs}</span>
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
                <span className="hero-stamp">{copy.setup.heroStamp}</span>
                <span className="panel-tag">{copy.setup.panelTag}</span>
              </div>
              <h2>{copy.setup.title}</h2>
              <p className="panel-intro">{copy.setup.intro}</p>
              <div className="hero-rundown">
                {copy.setup.steps.map((step) => (
                  <article className="rundown-card" key={step.code}>
                    <span className="rundown-index">{step.code}</span>
                    <div>
                      <h3>{step.title}</h3>
                      <p>{step.detail}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="form-panel setup-form-panel">
              <div className="panel-heading">
                <div>
                  <p className="panel-kicker">{copy.setup.panelKicker}</p>
                  <h2>{copy.setup.panelTitle}</h2>
                </div>
              </div>
              <p className="panel-intro">{copy.setup.panelIntro}</p>

              <label className="field" htmlFor="repository-url">
                <span>{copy.setup.repositoryLabel}</span>
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
                  placeholder={copy.setup.repositoryPlaceholder}
                  ref={urlInputRef}
                  type="url"
                  value={repositoryUrl}
                />
                <span className={repositoryUrlInvalid ? "field-help field-help-error" : "field-help"} id={repositoryHelpId}>
                  {resolveFieldError(locale, fieldErrors.repositoryUrl) ?? copy.setup.repositoryHelp}
                </span>
              </label>

              <div className="setup-secondary-grid">
                <label className="field" htmlFor="ref-override">
                  <span>{copy.setup.refLabel}</span>
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
                    placeholder={copy.setup.refPlaceholder}
                    type="text"
                    value={refValue}
                  />
                  <span className="field-help">{copy.setup.refHelp}</span>
                </label>

                <div className="field">
                  <label htmlFor="destination-input">
                    <span>{copy.setup.destinationLabel}</span>
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
                      placeholder={copy.setup.destinationPlaceholder}
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
                      {copy.actions.browse}
                    </button>
                  </div>
                  <span className={destinationInvalid ? "field-help field-help-error" : "field-help"} id={destinationHelpId}>
                    {resolveFieldError(locale, fieldErrors.destination) ?? copy.setup.destinationHelp}
                  </span>
                </div>
              </div>

              <div className="setup-actions-row">
                <label className="checkbox-field">
                  <input
                    checked={overwrite}
                    disabled={busy}
                    onChange={(event) => setOverwrite(event.target.checked)}
                    type="checkbox"
                  />
                  <span>{copy.setup.overwriteLabel}</span>
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
                    {copy.actions.inspect}
                  </button>
                  <button
                    className="secondary-action-button"
                    disabled={busy || selectedCount === 0}
                    onClick={() => {
                      void handleInstall();
                    }}
                    type="button"
                  >
                    {copy.actions.installSelected}
                  </button>
                  <button
                    className="ghost-button"
                    disabled={busy}
                    onClick={clearCandidates}
                    type="button"
                  >
                    {copy.actions.clear}
                  </button>
                </div>
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
                  <p className="panel-kicker">{copy.shortlist.panelKicker}</p>
                  <h2>{copy.shortlist.panelTitle}</h2>
                </div>
                <div className="mini-stats">
                  <span>{copy.metrics.found(candidates.length)}</span>
                  <span>{copy.metrics.selected(selectedCount)}</span>
                </div>
              </div>
              <p className="panel-intro">{copy.shortlist.panelIntro}</p>
              <div className="workspace-focus-note">
                <span>{copy.shortlist.focusLabel}</span>
                <p>{shortlistHint}</p>
              </div>

              <div className="candidate-stage">
                {candidates.length === 0 ? (
                  <div className="empty-state">
                    <p>{copy.shortlist.emptyTitle}</p>
                    <span>{copy.shortlist.emptyCopy}</span>
                  </div>
                ) : (
                  <>
                    <div className="candidate-toolbar">
                      <p>{copy.shortlist.toolbarCopy}</p>
                      <div className="candidate-toolbar-actions">
                        <button
                          className="ghost-button candidate-toolbar-button"
                          disabled={busy}
                          onClick={selectAllCandidates}
                          type="button"
                        >
                          {copy.shortlist.selectAll}
                        </button>
                        <button
                          className="ghost-button candidate-toolbar-button"
                          disabled={busy || selectedCount === 0}
                          onClick={clearSelectedCandidates}
                          type="button"
                        >
                          {copy.shortlist.clearSelection}
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
                                  <span className="candidate-chip">{checked ? copy.shortlist.queued : copy.shortlist.available}</span>
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
                  <p className="panel-kicker">{copy.transcript.panelKicker}</p>
                  <h2>{copy.transcript.panelTitle}</h2>
                </div>
                {result ? (
                  <div className="mini-stats">
                    <span>{copy.metrics.installed(result.installedCount)}</span>
                    <span>{copy.metrics.skipped(result.skippedCount)}</span>
                    <span>{copy.metrics.failed(result.failedCount)}</span>
                  </div>
                ) : null}
              </div>
              <p className="panel-intro">{copy.transcript.panelIntro}</p>
              <div className="workspace-focus-note workspace-focus-note-ledger">
                <span>{copy.transcript.focusLabel}</span>
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
            <p className="panel-kicker">{copy.dialogTone[dialog.tone]}</p>
            <h3 id="dialog-title">{dialog.title}</h3>
            <p id="dialog-message">{dialog.message}</p>
            <div className="dialog-actions">
              <button
                className="ghost-button"
                onClick={closeDialog}
                type="button"
              >
                {copy.dialogActions.dismiss}
              </button>
              <button
                className="primary-button"
                onClick={closeDialog}
                ref={dialogCloseButtonRef}
                type="button"
              >
                {copy.dialogActions.close}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
