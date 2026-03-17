export type DialogTone = "info" | "warn" | "error";
export type LogTone = DialogTone | "success";

export interface SkillCandidate {
  name: string;
  path: string;
  description: string;
  sourceRef: string | null;
}

export interface InstallOutcome {
  candidate: SkillCandidate;
  installed: boolean;
  skipped: boolean;
  message: string;
  destination: string;
}

export interface SkillInspectResult {
  ok: boolean;
  repositoryUrl: string;
  ref: string | null;
  candidates: SkillCandidate[];
  logs: string[];
}

export interface SkillInstallResult {
  ok: boolean;
  repositoryUrl: string;
  destination: string;
  ref: string | null;
  overwrite: boolean;
  selectedPaths: string[];
  outcomes: InstallOutcome[];
  logs: string[];
  summary: string;
  installedCount: number;
  skippedCount: number;
  failedCount: number;
}

export interface AppDialog {
  tone: DialogTone;
  title: string;
  message: string;
}

export interface LogEntry {
  id: number;
  tone: LogTone;
  text: string;
}
