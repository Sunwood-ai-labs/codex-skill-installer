import { invoke } from "@tauri-apps/api/core";

import type { SkillInspectResult, SkillInstallResult } from "./types";

const tauriWindow = globalThis as typeof globalThis & {
  __TAURI_INTERNALS__?: unknown;
};

function ensureTauriRuntime(): void {
  if (!tauriWindow.__TAURI_INTERNALS__) {
    throw new Error("Tauri runtime is not available. Launch the app with `npm run tauri dev`.");
  }
}

export async function fetchDefaultDestination(): Promise<string> {
  ensureTauriRuntime();
  return invoke<string>("default_destination");
}

export async function pickDestination(): Promise<string | null> {
  ensureTauriRuntime();
  return invoke<string | null>("pick_destination");
}

export async function inspectRepository(
  repositoryUrl: string,
  refValue: string,
): Promise<SkillInspectResult> {
  ensureTauriRuntime();
  return invoke<SkillInspectResult>("inspect_repository", {
    repositoryUrl,
    refValue: refValue.trim() || null,
  });
}

export async function installSkills(
  repositoryUrl: string,
  selectedPaths: string[],
  destination: string,
  overwrite: boolean,
  refValue: string,
): Promise<SkillInstallResult> {
  ensureTauriRuntime();
  return invoke<SkillInstallResult>("install_skills", {
    repositoryUrl,
    selectedPaths,
    destination,
    overwrite,
    refValue: refValue.trim() || null,
  });
}
