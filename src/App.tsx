import { startTransition, useEffect, useRef, useState } from "react";

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

export default function App() {
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
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: nextLogId(),
      tone: "info",
      text: READY_TEXT,
    },
  ]);
  const logViewportRef = useRef<HTMLDivElement | null>(null);

  function appendLog(tone: LogTone, text: string): void {
    setLogs((current) => [
      ...current,
      {
        id: nextLogId(),
        tone,
        text,
      },
    ]);
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

  function validateInputs(): string[] {
    const issues: string[] = [];
    if (!repositoryUrl.trim()) {
      issues.push("Repository URL is required.");
    } else if (!isGithubUrl(repositoryUrl)) {
      issues.push("Repository URL must be a valid GitHub URL.");
    }

    if (!destination.trim()) {
      issues.push("Destination directory is required.");
    }

    return issues;
  }

  function showDialog(tone: AppDialog["tone"], title: string, message: string): void {
    setDialog({ tone, title, message });
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

  async function handleBrowse(): Promise<void> {
    try {
      const picked = await pickDestination();
      if (picked) {
        setDestination(picked);
      }
    } catch (error) {
      const message = toErrorMessage(error);
      appendLog("error", `[ERROR] ${message}`);
      showDialog("error", "Folder picker failed", message);
    }
  }

  async function handleInspect(): Promise<void> {
    const issues = validateInputs();
    if (issues.length > 0) {
      appendLog("warn", `[WARN] ${issues.join("; ")}`);
      return;
    }

    setBusy(true);
    setBusyLabel("Inspecting repository...");
    setResult(null);
    appendLog("info", "Inspecting repository...");

    try {
      const inspectResult = await inspectRepository(repositoryUrl, refValue);
      startTransition(() => {
        setCandidates(inspectResult.candidates);
        setSelectedPaths(inspectResult.candidates.map((candidate) => candidate.path));
      });

      for (const line of inspectResult.logs) {
        appendLog("info", `[INFO] ${line}`);
      }

      if (inspectResult.candidates.length === 0) {
        appendLog("info", "No candidates detected.");
      }
    } catch (error) {
      const message = toErrorMessage(error);
      appendLog("error", `[ERROR] ${message}`);
      showDialog("error", "Inspection failed", message);
    } finally {
      setBusy(false);
      setBusyLabel(READY_TEXT);
    }
  }

  async function handleInstall(): Promise<void> {
    const chosen = selectedPaths.filter((path) => path.trim().length > 0);
    if (chosen.length === 0) {
      appendLog("warn", "No skill candidates selected.");
      showDialog("warn", "Nothing selected", "Please select at least one candidate.");
      return;
    }

    const issues = validateInputs();
    if (issues.length > 0) {
      appendLog("warn", `[WARN] ${issues.join("; ")}`);
      return;
    }

    setBusy(true);
    setBusyLabel("Installing selected skills...");
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
        showDialog("info", "Install completed", installResult.summary);
      } else {
        showDialog("error", "Install failed", installResult.summary);
      }
    } catch (error) {
      const message = toErrorMessage(error);
      appendLog("error", `[ERROR] ${message}`);
      showDialog("error", "Install failed", message);
    } finally {
      setBusy(false);
      setBusyLabel(READY_TEXT);
    }
  }

  const selectedCount = selectedPaths.length;
  const latestStatus = busy ? busyLabel : logs.at(-1)?.text ?? READY_TEXT;

  return (
    <div className="app-shell">
      <div className="background-glow background-glow-left" />
      <div className="background-glow background-glow-right" />

      <main className="workspace">
        <section className="hero-panel">
          <div className="hero-copy">
            <p className="eyebrow">Tauri 2 Desktop</p>
            <h1>Codex Skill Installer</h1>
            <p className="hero-text">
              Inspect GitHub skill repositories, choose the `SKILL.md` directories you want,
              and install them into your local Codex profile without hauling an Electron-sized
              runtime around.
            </p>
          </div>

          <div className="hero-status">
            <span className={`status-pill ${busy ? "status-pill-busy" : ""}`}>
              {busy ? "Working" : "Ready"}
            </span>
            <p>{latestStatus}</p>
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

            <label className="field">
              <span>GitHub URL</span>
              <input
                disabled={busy}
                onChange={(event) => setRepositoryUrl(event.target.value)}
                placeholder="https://github.com/owner/repo or /tree/ref/path"
                type="url"
                value={repositoryUrl}
              />
            </label>

            <label className="field">
              <span>Ref override</span>
              <input
                disabled={busy}
                onChange={(event) => setRefValue(event.target.value)}
                placeholder="optional override"
                type="text"
                value={refValue}
              />
            </label>

            <div className="field">
              <span>Install to</span>
              <div className="destination-row">
                <input
                  disabled={busy}
                  onChange={(event) => setDestination(event.target.value)}
                  placeholder="Choose a Codex skills directory"
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
                className="accent-button"
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
                        <div>
                          <strong>{candidate.name}</strong>
                          <p>{candidate.path}</p>
                          {candidate.description ? <span>{candidate.description}</span> : null}
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>
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

            <div className="log-viewport" ref={logViewportRef}>
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
            role="dialog"
          >
            <p className="panel-kicker">{dialog.tone.toUpperCase()}</p>
            <h3 id="dialog-title">{dialog.title}</h3>
            <p id="dialog-message">{dialog.message}</p>
            <button
              className="primary-button"
              onClick={() => setDialog(null)}
              type="button"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
