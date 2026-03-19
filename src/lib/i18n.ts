import type { InstallOutcome, SkillInstallResult } from "./types";

export type Locale = "en" | "ja";
export type BusyState = "ready" | "inspecting" | "installing";
export type FieldErrorKey =
  | "repositoryRequired"
  | "repositoryInvalid"
  | "destinationRequired";

const LOCALE_STORAGE_KEY = "codex-skill-forge.locale";

export const UI_COPY = {
  en: {
    appTitle: "Codex Skill Installer",
    titlebarSubtitle: "Editorial vault control",
    languageLabel: "Language",
    localeOptions: {
      en: "EN",
      ja: "Japanese",
    },
    busyState: {
      ready: "Ready",
      inspecting: "Inspecting repository...",
      installing: "Installing selected skills...",
    },
    titlebar: {
      maximized: "Maximized",
      noShortlist: "No shortlist yet",
      selectionLabel: (count: number) => `${count} marked for install`,
    },
    windowControls: {
      toolbar: "Window controls",
      minimize: "Minimize window",
      minimizeTitle: "Minimize",
      maximize: "Maximize window",
      maximizeTitle: "Maximize",
      restore: "Restore window",
      restoreTitle: "Restore window",
      close: "Close window",
      closeTitle: "Close",
      failedTitle: "Window controls failed",
    },
    dialogActions: {
      dismiss: "Dismiss",
      close: "Close",
    },
    dialogTone: {
      info: "Notice",
      warn: "Warning",
      error: "Error",
    },
    tabs: {
      setup: "Setup",
      candidates: "Shortlist",
      logs: "Transcript",
    },
    workspaceSectionsLabel: "Workspace sections",
    headerEyebrow: "Field Manual 01",
    workspace: {
      setupTitle: "Setup desk",
      setupCopy: "Confirm the repository and destination, then inspect before you shortlist.",
      candidatesTitle: "Shortlist review",
      candidatesCopy:
        "Keep the list tight and deliberate. The shortlist should feel curated, not dumped onto one long page.",
      logsTitle: "Session transcript",
      logsCopy:
        "Treat the ledger as a control room. Every inspect and install event stays in reach while you work.",
    },
    metrics: {
      found: (count: number) => `${count} found`,
      marked: (count: number) => `${count} marked`,
      ledgerLines: (count: number) => `${count} ledger lines`,
      selected: (count: number) => `${count} selected`,
      installed: (count: number) => `${count} installed`,
      skipped: (count: number) => `${count} skipped`,
      failed: (count: number) => `${count} failed`,
    },
    setup: {
      heroStamp: "Curated desktop installer",
      panelTag: "Source / destination",
      title: "Curate skills before they enter your local vault.",
      intro:
        "Lock the repository and destination first, inspect next, then move to the shortlist once the source is stable.",
      panelKicker: "Acquisition Desk",
      panelTitle: "Source repository & local target",
      panelIntro:
        "Paste a GitHub URL, choose the target folder, then inspect. Existing installs stay untouched unless overwrite is enabled.",
      repositoryLabel: "GitHub URL",
      repositoryPlaceholder: "https://github.com/owner/repo or /tree/ref/path",
      repositoryHelp: "Repository, tree, and blob URLs are supported.",
      refLabel: "Ref override",
      refPlaceholder: "optional override",
      refHelp: "Optional: inspect a different branch or tag.",
      destinationLabel: "Install to",
      destinationPlaceholder: "Choose a Codex skills directory",
      destinationHelp: "Defaults to your Codex skills directory when available.",
      overwriteLabel: "Overwrite existing skill folders",
      steps: [
        {
          code: "01",
          title: "Inspect the archive",
          detail: "Scan the repository and list only folders that actually ship with `SKILL.md` or `skill.md`.",
        },
        {
          code: "02",
          title: "Mark the shortlist",
          detail: "Review each candidate and mark only the skills that belong in your vault.",
        },
        {
          code: "03",
          title: "Install to your vault",
          detail: "Install the selected skills and keep a clear session record of the run.",
        },
      ],
    },
    shortlist: {
      panelKicker: "Archive Review",
      panelTitle: "Candidate shortlist",
      panelIntro:
        "Treat this as a catalog table, not a download bucket. Review each folder, then mark the ones that deserve a place in your Codex profile.",
      focusLabel: "Review mode",
      emptyTitle: "Shortlist is empty.",
      emptyCopy: "Run inspect to scan the repository archive for folders that ship with `SKILL.md` or `skill.md`.",
      toolbarCopy: "Inspect first, then mark only the candidates that belong in your vault.",
      selectAll: "Select all",
      clearSelection: "Clear selection",
      queued: "Queued",
      available: "Available",
      hints: {
        empty: "Run inspect to build the shortlist.",
        noneSelected: "Review each detected folder before you queue it.",
        selected: (count: number) => `${count} folders are marked and ready for install review.`,
      },
    },
    transcript: {
      panelKicker: "Session Transcript",
      panelTitle: "Logs & outcomes",
      panelIntro:
        "Every inspection and install event is written into the ledger below so you can verify what happened without guessing.",
      focusLabel: "Ledger focus",
      hints: {
        busy: "The ledger is active. Keep this view open while the installer writes.",
        result: "Audit the final outcomes before you close the session.",
        idle: "The ledger stays quiet until inspection or install starts.",
      },
    },
    actions: {
      browse: "Browse",
      inspect: "Inspect",
      installSelected: "Install selected",
      clear: "Clear",
    },
    dialogs: {
      folderPickerFailed: "Folder picker failed",
      inspectionFailed: "Inspection failed",
      nothingSelected: "Nothing selected",
      installCompleted: "Install completed",
      installFailed: "Install failed",
      pleaseSelectAtLeastOneCandidate: "Please select at least one candidate.",
    },
    fieldErrors: {
      repositoryRequired: "Repository URL is required.",
      repositoryInvalid: "Repository URL must be a valid GitHub URL.",
      destinationRequired: "Destination directory is required.",
    },
    logs: {
      ready: "Ready.",
      noCandidates: "No candidates detected.",
      reviewDetected: "Review the detected skills, then choose which ones to install.",
      noSelection: "No skill candidates selected.",
      candidateCleared: "Candidate list cleared.",
      infoTag: "[INFO]",
      warnTag: "[WARN]",
      errorTag: "[ERROR]",
      successTag: "[OK]",
      windowStateReadFailed: "Window state could not be read.",
    },
    genericUnexpected: "Unexpected error.",
    runtimeUnavailable: "Tauri runtime is not available. Launch the app with `npm run tauri dev`.",
    outcomeStatus: {
      installed: "installed",
      skipped: "skipped",
      failed: "failed",
    },
  },
  ja: {
    appTitle: "Codex Skill Installer",
    titlebarSubtitle: "編集用保管庫コントロール",
    languageLabel: "言語",
    localeOptions: {
      en: "EN",
      ja: "日本語",
    },
    busyState: {
      ready: "準備完了",
      inspecting: "リポジトリを確認中...",
      installing: "選択したスキルをインストール中...",
    },
    titlebar: {
      maximized: "最大化中",
      noShortlist: "まだ候補はありません",
      selectionLabel: (count: number) => `${count} 件を選択済み`,
    },
    windowControls: {
      toolbar: "ウィンドウ操作",
      minimize: "ウィンドウを最小化",
      minimizeTitle: "最小化",
      maximize: "ウィンドウを最大化",
      maximizeTitle: "最大化",
      restore: "ウィンドウを元に戻す",
      restoreTitle: "元に戻す",
      close: "ウィンドウを閉じる",
      closeTitle: "閉じる",
      failedTitle: "ウィンドウ操作に失敗しました",
    },
    dialogActions: {
      dismiss: "閉じる",
      close: "閉じる",
    },
    dialogTone: {
      info: "通知",
      warn: "警告",
      error: "エラー",
    },
    tabs: {
      setup: "セットアップ",
      candidates: "ショートリスト",
      logs: "トランスクリプト",
    },
    workspaceSectionsLabel: "ワークスペースのセクション",
    headerEyebrow: "操作手引き 01",
    workspace: {
      setupTitle: "セットアップデスク",
      setupCopy: "リポジトリと保存先を確認してから、ショートリストに進みます。",
      candidatesTitle: "ショートリストの確認",
      candidatesCopy:
        "一覧は詰め込みではなく、きちんと選び抜かれたものとして扱ってください。",
      logsTitle: "セッション記録",
      logsCopy:
        "記録台帳を指令室のように扱い、確認とインストールの履歴を常に見える状態に保ちます。",
    },
    metrics: {
      found: (count: number) => `${count} 件を検出`,
      marked: (count: number) => `${count} 件をマーク`,
      ledgerLines: (count: number) => `${count} 行の記録`,
      selected: (count: number) => `${count} 件を選択`,
      installed: (count: number) => `${count} 件をインストール`,
      skipped: (count: number) => `${count} 件をスキップ`,
      failed: (count: number) => `${count} 件が失敗`,
    },
    setup: {
      heroStamp: "厳選デスクトップインストーラ",
      panelTag: "ソース / 保存先",
      title: "ローカル保管庫に入れる前に、スキルを厳選する。",
      intro:
        "最初にリポジトリと保存先を固定し、次に確認を行って、安定したらショートリストへ進みます。",
      panelKicker: "取得デスク",
      panelTitle: "ソースリポジトリと保存先",
      panelIntro:
        "GitHub URL を貼り付け、保存先フォルダを選んでから確認します。上書きを有効にしない限り、既存のインストールはそのまま残ります。",
      repositoryLabel: "GitHub URL",
      repositoryPlaceholder: "https://github.com/owner/repo または /tree/ref/path",
      repositoryHelp: "repository / tree / blob の URL に対応しています。",
      refLabel: "Ref の上書き",
      refPlaceholder: "任意のブランチまたはタグ",
      refHelp: "必要なら別の branch や tag を確認できます。",
      destinationLabel: "インストール先",
      destinationPlaceholder: "Codex の skills ディレクトリを選択",
      destinationHelp: "利用可能な場合は Codex の skills ディレクトリが既定値になります。",
      overwriteLabel: "既存のスキルフォルダを上書きする",
      steps: [
        {
          code: "01",
          title: "アーカイブを確認",
          detail: "リポジトリを走査し、skill manifest（`SKILL.md` または `skill.md`）を含むフォルダだけを一覧化します。",
        },
        {
          code: "02",
          title: "ショートリストを選ぶ",
          detail: "各候補を確認し、保管庫に入れるべきスキルだけを選択します。",
        },
        {
          code: "03",
          title: "保管庫へインストール",
          detail: "選択したスキルをインストールし、実行内容を記録として残します。",
        },
      ],
    },
    shortlist: {
      panelKicker: "アーカイブレビュー",
      panelTitle: "候補のショートリスト",
      panelIntro:
        "ここはダウンロード置き場ではなく、きちんと目を通すための一覧表です。各フォルダを確認して、Codex プロファイルに入れるものだけを選んでください。",
      focusLabel: "レビュー中",
      emptyTitle: "ショートリストは空です。",
      emptyCopy: "確認を実行すると、skill manifest（`SKILL.md` または `skill.md`）を含むフォルダをスキャンできます。",
      toolbarCopy: "先に確認し、保管庫に入れる候補だけを選択してください。",
      selectAll: "すべて選択",
      clearSelection: "選択解除",
      queued: "キュー済み",
      available: "利用可能",
      hints: {
        empty: "確認を実行してショートリストを作成してください。",
        noneSelected: "検出されたフォルダを確認してからキューに入れてください。",
        selected: (count: number) => `${count} 件のフォルダが選択され、インストール確認待ちです。`,
      },
    },
    transcript: {
      panelKicker: "セッション記録",
      panelTitle: "ログと結果",
      panelIntro:
        "確認とインストールのすべてのイベントを下の記録台帳に書き出すので、何が起きたかを推測せずに追跡できます。",
      focusLabel: "記録台帳",
      hints: {
        busy: "記録台帳は動作中です。インストーラが書き込んでいる間もこの画面を開いておいてください。",
        result: "セッションを閉じる前に、最終結果を確認してください。",
        idle: "確認またはインストールが始まるまで、記録台帳は静かなままです。",
      },
    },
    actions: {
      browse: "参照",
      inspect: "確認",
      installSelected: "選択した項目をインストール",
      clear: "クリア",
    },
    dialogs: {
      folderPickerFailed: "フォルダ選択に失敗しました",
      inspectionFailed: "確認に失敗しました",
      nothingSelected: "何も選択されていません",
      installCompleted: "インストール完了",
      installFailed: "インストールに失敗しました",
      pleaseSelectAtLeastOneCandidate: "少なくとも 1 件は候補を選択してください。",
    },
    fieldErrors: {
      repositoryRequired: "リポジトリ URL は必須です。",
      repositoryInvalid: "有効な GitHub URL を指定してください。",
      destinationRequired: "保存先ディレクトリは必須です。",
    },
    logs: {
      ready: "準備完了。",
      noCandidates: "候補は検出されませんでした。",
      reviewDetected: "検出されたスキルを確認して、インストールするものを選んでください。",
      noSelection: "選択されたスキル候補がありません。",
      candidateCleared: "候補一覧をクリアしました。",
      infoTag: "[INFO]",
      warnTag: "[WARN]",
      errorTag: "[ERROR]",
      successTag: "[OK]",
      windowStateReadFailed: "ウィンドウ状態を読み取れませんでした。",
    },
    genericUnexpected: "予期しないエラーが発生しました。",
    runtimeUnavailable: "Tauri ランタイムが利用できません。`npm run tauri dev` で起動してください。",
    outcomeStatus: {
      installed: "インストール済み",
      skipped: "スキップ",
      failed: "失敗",
    },
  },
} as const;

export function normalizeLocale(value: string | null | undefined): Locale {
  return value?.toLowerCase().startsWith("ja") ? "ja" : "en";
}

export function detectInitialLocale(): Locale {
  if (typeof window === "undefined") {
    return "en";
  }

  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored) {
    return normalizeLocale(stored);
  }

  return normalizeLocale(window.navigator.language);
}

export function persistLocale(locale: Locale): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  document.documentElement.lang = locale;
}

export function getUiCopy(locale: Locale) {
  return UI_COPY[locale];
}

export function resolveFieldError(locale: Locale, error: FieldErrorKey | null): string | null {
  if (!error) {
    return null;
  }
  return getUiCopy(locale).fieldErrors[error];
}

export function formatTaggedLog(
  locale: Locale,
  tone: "info" | "warn" | "error" | "success",
  message: string,
): string {
  const copy = getUiCopy(locale);
  const tag = tone === "info"
    ? copy.logs.infoTag
    : tone === "warn"
      ? copy.logs.warnTag
      : tone === "error"
        ? copy.logs.errorTag
        : copy.logs.successTag;

  return `${tag} ${message}`;
}

export function formatOutcomeLine(locale: Locale, outcome: InstallOutcome): string {
  const copy = getUiCopy(locale);
  const statusLabel = outcome.installed
    ? copy.outcomeStatus.installed
    : outcome.skipped
      ? copy.outcomeStatus.skipped
      : copy.outcomeStatus.failed;
  const localizedMessage = localizeServiceMessage(outcome.message, locale);
  const prefix = locale === "en" ? statusLabel.padEnd(8, " ") : statusLabel;
  return `${prefix} ${outcome.candidate.name} -> ${outcome.destination} (${localizedMessage})`;
}

export function formatInstallSummary(locale: Locale, result: SkillInstallResult): string {
  const copy = getUiCopy(locale);
  if (locale === "ja") {
    return `${copy.metrics.installed(result.installedCount)} / ${copy.metrics.skipped(result.skippedCount)} / ${copy.metrics.failed(result.failedCount)}`;
  }

  return `${result.installedCount} installed, ${result.skippedCount} skipped, ${result.failedCount} failed`;
}

export function toDisplayErrorMessage(error: unknown, locale: Locale): string {
  if (error instanceof Error && error.message) {
    return localizeServiceMessage(error.message, locale);
  }
  if (typeof error === "string" && error.trim()) {
    return localizeServiceMessage(error, locale);
  }
  return getUiCopy(locale).genericUnexpected;
}

export function localizeServiceMessage(message: string, locale: Locale): string {
  if (locale === "en") {
    return message;
  }

  if (message === "Skill manifest is missing a parent directory.") {
    return "skill manifest に親ディレクトリがありません。";
  }

  if (message === "No skill manifest directories found in the selected repository scope.") {
    return "選択したリポジトリ範囲に skill manifest (SKILL.md / skill.md) を含むディレクトリが見つかりませんでした。";
  }

  const exactMessages = new Map<string, string>([
    ["installed", "インストールしました。"],
    ["URL must be http(s).", "URL は http(s) である必要があります。"],
    ["Only github.com repository URLs are supported.", "github.com のリポジトリ URL のみ対応しています。"],
    ["URL must include owner and repository.", "URL には owner と repository を含めてください。"],
    ["tree URL format must be /tree/{ref} or /tree/{ref}/{path}.", "tree URL は /tree/{ref} または /tree/{ref}/{path} の形式にしてください。"],
    ["blob/raw URL format must be /blob/{ref}/{path}.", "blob/raw URL は /blob/{ref}/{path} の形式にしてください。"],
    ["Failed to download repository archive.", "リポジトリアーカイブの取得に失敗しました。"],
    ["Unexpected archive layout: expected a single top-level directory.", "予期しないアーカイブ構成です。トップレベル ディレクトリは 1 つである必要があります。"],
    ["SKILL.md is missing a parent directory.", "SKILL.md に親ディレクトリがありません。"],
    ["Failed to resolve skill path relative to archive root.", "アーカイブのルートからスキルのパスを解決できませんでした。"],
    ["Skill directory name is invalid.", "スキルディレクトリ名が不正です。"],
    ["Failed to resolve manifest path relative to archive root.", "アーカイブのルートからマニフェストパスを解決できませんでした。"],
    ["No SKILL.md directories found in the selected repository scope.", "選択したリポジトリ範囲に SKILL.md を含むディレクトリが見つかりませんでした。"],
    ["Archive contains an empty path.", "アーカイブに空のパスが含まれています。"],
    ["Destination already exists and overwrite is false.", "保存先は既に存在し、overwrite は無効です。"],
  ]);

  const exact = exactMessages.get(message);
  if (exact) {
    return exact;
  }

  const pathMessage = /^(.+): (.+)$/.exec(message);
  if (pathMessage) {
    const localizedTail = localizeServiceMessage(pathMessage[2], locale);
    if (localizedTail !== pathMessage[2]) {
      return `${pathMessage[1]}: ${localizedTail}`;
    }
  }

  const manifestNotFound = /^Skill manifest not found in (.+)$/.exec(message);
  if (manifestNotFound) {
    return `${manifestNotFound[1]} に skill manifest (SKILL.md / skill.md) が見つかりません`;
  }

  const duplicateManifest = /^Multiple skill manifests found in (.+)$/.exec(message);
  if (duplicateManifest) {
    return `${duplicateManifest[1]} に複数の skill manifest (SKILL.md / skill.md) が見つかりました`;
  }

  const matchers: Array<[RegExp, (...groups: string[]) => string]> = [
    [/^Detected (\d+) skill candidate\(s\)\.$/, (count) => `${count} 件のスキル候補を検出しました。`],
    [/^(\d+) installed, (\d+) skipped, (\d+) failed$/, (installed, skipped, failed) => `${installed} 件インストール / ${skipped} 件スキップ / ${failed} 件失敗`],
    [/^Repository: (.+)$/, (name) => `リポジトリ: ${name}`],
    [/^Snapshot ref: (.+)$/, (refName) => `スナップショット ref: ${refName}`],
    [/^Requested: \((all)\)$/, () => "指定: すべて"],
    [/^Requested: (.+)$/, (requested) => `指定: ${requested}`],
    [/^Failed to download archive: (.+)$/, (reason) => `アーカイブの取得に失敗しました: ${reason}`],
    [/^GitHub returned HTTP (.+) for (.+)$/, (status, url) => `GitHub が HTTP ${status} を返しました: ${url}`],
    [/^Scope path does not exist: (.+)$/, (path) => `指定したスコープパスが存在しません: ${path}`],
    [/^None of requested skill names were found: (.+)$/, (names) => `指定したスキル名は見つかりませんでした: ${names}`],
    [/^Ambiguous skill selector '(.+)'\. Use a unique path\.$/, (name) => `スキルセレクタ '${name}' は曖昧です。固有のパスを指定してください。`],
    [/^Multiple selected skills would install to '(.+)'\.$/, (destination) => `複数の選択済みスキルが '${destination}' にインストールされます。`],
    [/^SKILL\.md not found in (.+)$/, (path) => `${path} に SKILL.md が見つかりません`],
    [/^Existing path is not a directory: (.+)$/, (path) => `既存のパスはディレクトリではありません: ${path}`],
    [/^Archive contains an unsupported tar member type: (.+)$/, (member) => `アーカイブに未対応の tar メンバー型が含まれています: ${member}`],
    [/^Archive contains an unsafe path: (.+)$/, (path) => `アーカイブに安全でないパスが含まれています: ${path}`],
  ];

  for (const [pattern, render] of matchers) {
    const matched = pattern.exec(message);
    if (matched) {
      return render(...matched.slice(1));
    }
  }

  return message;
}
