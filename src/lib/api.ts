import { invoke } from "@tauri-apps/api/core";

import type { Locale } from "./i18n";
import type { SkillInspectResult, SkillInstallResult } from "./types";

const tauriWindow = globalThis as typeof globalThis & {
  __TAURI_INTERNALS__?: unknown;
};

function ensureTauriRuntime(locale: Locale): void {
  if (!tauriWindow.__TAURI_INTERNALS__) {
    throw new Error(
      locale === "ja"
        ? "Tauri ランタイムが利用できません。`npm run tauri dev` でアプリを起動してください。"
        : "Tauri runtime is not available. Launch the app with `npm run tauri dev`.",
    );
  }
}

export async function fetchDefaultDestination(locale: Locale): Promise<string> {
  ensureTauriRuntime(locale);
  return invoke<string>("default_destination");
}

export async function pickDestination(locale: Locale): Promise<string | null> {
  ensureTauriRuntime(locale);
  return invoke<string | null>("pick_destination");
}

export async function inspectRepository(
  repositoryUrl: string,
  refValue: string,
  locale: Locale,
): Promise<SkillInspectResult> {
  ensureTauriRuntime(locale);
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
  locale: Locale,
): Promise<SkillInstallResult> {
  ensureTauriRuntime(locale);
  return invoke<SkillInstallResult>("install_skills", {
    repositoryUrl,
    selectedPaths,
    destination,
    overwrite,
    refValue: refValue.trim() || null,
  });
}
