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
      ja: "日本語",
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
          detail: "Scan the repository and list only folders that actually ship with SKILL.md.",
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
      emptyCopy: "Run inspect to scan the repository archive for folders that ship with `SKILL.md`.",
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
    titlebarSubtitle: "スキル保管庫コントロール",
    languageLabel: "言語",
    localeOptions: {
      en: "EN",
      ja: "日本語",
    },
    busyState: {
      ready: "準備完了",
      inspecting: "リポジトリを検査中...",
      installing: "選択したスキルをインストール中...",
    },
    titlebar: {
      maximized: "最大化",
      noShortlist: "未選択",
      selectionLabel: (count: number) => `${count}件を選択中`,
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
      info: "案内",
      warn: "警告",
      error: "エラー",
    },
    tabs: {
      setup: "設定",
      candidates: "候補一覧",
      logs: "ログ",
    },
    workspaceSectionsLabel: "ワークスペース切替",
    headerEyebrow: "運用手引 01",
    workspace: {
      setupTitle: "セットアップデスク",
      setupCopy: "リポジトリと保存先を確認してから検査し、候補一覧へ進みます。",
      candidatesTitle: "候補レビュー",
      candidatesCopy:
        "候補は絞り込んで扱います。長い一覧に流し込むのではなく、意図的に選別します。",
      logsTitle: "セッショントランスクリプト",
      logsCopy: "検査とインストールの記録を確認しながら進められるよう、操作履歴をまとめて保持します。",
    },
    metrics: {
      found: (count: number) => `${count}件検出`,
      marked: (count: number) => `${count}件選択`,
      ledgerLines: (count: number) => `${count}件ログ`,
      selected: (count: number) => `${count}件選択`,
      installed: (count: number) => `${count}件インストール`,
      skipped: (count: number) => `${count}件スキップ`,
      failed: (count: number) => `${count}件失敗`,
    },
    setup: {
      heroStamp: "デスクトップインストーラー",
      panelTag: "取得元 / 保存先",
      title: "ローカル保管庫に入れる前に、スキルを丁寧に選別します。",
      intro:
        "先にリポジトリと保存先を固定し、そのあと検査します。取得元が固まってから候補一覧へ進みます。",
      panelKicker: "取得デスク",
      panelTitle: "取得元リポジトリと保存先",
      panelIntro:
        "GitHub URL と保存先を指定してから検査します。上書きを有効にしない限り、既存のインストールはそのまま残ります。",
      repositoryLabel: "GitHub URL",
      repositoryPlaceholder: "https://github.com/owner/repo または /tree/ref/path",
      repositoryHelp: "repository / tree / blob URL に対応しています。",
      refLabel: "Ref 上書き",
      refPlaceholder: "任意のブランチやタグ",
      refHelp: "別のブランチやタグを検査したいときに使います。",
      destinationLabel: "保存先",
      destinationPlaceholder: "Codex skills ディレクトリを選択",
      destinationHelp: "既定では Codex skills ディレクトリを使用します。",
      overwriteLabel: "既存のスキルフォルダーを上書きする",
      steps: [
        {
          code: "01",
          title: "アーカイブを検査",
          detail: "リポジトリを走査し、実際に SKILL.md を含むフォルダーだけを洗い出します。",
        },
        {
          code: "02",
          title: "候補を選別",
          detail: "見つかった候補を確認し、本当に保管庫へ入れるものだけを選びます。",
        },
        {
          code: "03",
          title: "保管庫へ導入",
          detail: "選んだスキルをインストールし、実行内容をログに残します。",
        },
      ],
    },
    shortlist: {
      panelKicker: "アーカイブレビュー",
      panelTitle: "候補ショートリスト",
      panelIntro:
        "これは一括投入の場ではなく、選別のための一覧です。各フォルダーを確認してから Codex プロファイルへ入れるものだけを選びます。",
      focusLabel: "レビュー状態",
      emptyTitle: "候補はまだありません。",
      emptyCopy: "検査を実行すると、`SKILL.md` を含むフォルダーがここに表示されます。",
      toolbarCopy: "先に検査し、保管庫へ入れる候補だけを選択します。",
      selectAll: "すべて選択",
      clearSelection: "選択解除",
      queued: "選択済み",
      available: "候補",
      hints: {
        empty: "まず検査を実行して候補一覧を作成します。",
        noneSelected: "検出された各フォルダーを確認してから選択します。",
        selected: (count: number) => `${count}件を選択中です。インストール前に内容を再確認できます。`,
      },
    },
    transcript: {
      panelKicker: "セッションログ",
      panelTitle: "ログと結果",
      panelIntro:
        "検査とインストールの各イベントをここへ記録し、何が起きたかを追跡できるようにします。",
      focusLabel: "ログ確認",
      hints: {
        busy: "処理中です。書き込みが終わるまでこのビューで進行を確認できます。",
        result: "セッションを閉じる前に最終結果を確認します。",
        idle: "検査かインストールを始めるまでは、ログは静かなままです。",
      },
    },
    actions: {
      browse: "参照",
      inspect: "検査",
      installSelected: "選択項目をインストール",
      clear: "クリア",
    },
    dialogs: {
      folderPickerFailed: "フォルダー選択に失敗しました",
      inspectionFailed: "検査に失敗しました",
      nothingSelected: "選択項目がありません",
      installCompleted: "インストール完了",
      installFailed: "インストール失敗",
      pleaseSelectAtLeastOneCandidate: "少なくとも1件の候補を選択してください。",
    },
    fieldErrors: {
      repositoryRequired: "リポジトリ URL は必須です。",
      repositoryInvalid: "GitHub の有効な URL を入力してください。",
      destinationRequired: "保存先ディレクトリは必須です。",
    },
    logs: {
      ready: "準備完了。",
      noCandidates: "候補は検出されませんでした。",
      reviewDetected: "検出されたスキルを確認して、インストールするものを選択してください。",
      noSelection: "スキル候補が選択されていません。",
      candidateCleared: "候補一覧をクリアしました。",
      infoTag: "[情報]",
      warnTag: "[警告]",
      errorTag: "[エラー]",
      successTag: "[完了]",
      windowStateReadFailed: "ウィンドウ状態を取得できませんでした。",
    },
    genericUnexpected: "予期しないエラーが発生しました。",
    runtimeUnavailable: "Tauri ランタイムが利用できません。`npm run tauri dev` でアプリを起動してください。",
    outcomeStatus: {
      installed: "導入",
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

  const exactMessages = new Map<string, string>([
    ["installed", "インストールしました。"],
    ["URL must be http(s).", "URL は http(s) である必要があります。"],
    ["Only github.com repository URLs are supported.", "github.com のリポジトリ URL のみ対応しています。"],
    ["URL must include owner and repository.", "URL には owner と repository が必要です。"],
    ["tree URL format must be /tree/{ref} or /tree/{ref}/{path}.", "tree URL は /tree/{ref} または /tree/{ref}/{path} の形式で指定してください。"],
    ["blob/raw URL format must be /blob/{ref}/{path}.", "blob/raw URL は /blob/{ref}/{path} の形式で指定してください。"],
    ["Failed to download repository archive.", "リポジトリアーカイブの取得に失敗しました。"],
    ["Unexpected archive layout: expected a single top-level directory.", "アーカイブ構成が想定外です。トップレベルディレクトリは 1 つである必要があります。"],
    ["SKILL.md is missing a parent directory.", "SKILL.md の親ディレクトリを特定できませんでした。"],
    ["Failed to resolve skill path relative to archive root.", "アーカイブルートからの相対スキルパスを解決できませんでした。"],
    ["Skill directory name is invalid.", "スキルディレクトリ名が不正です。"],
    ["Failed to resolve manifest path relative to archive root.", "アーカイブルートからのマニフェストパスを解決できませんでした。"],
    ["No SKILL.md directories found in the selected repository scope.", "選択したリポジトリ範囲内に SKILL.md を含むディレクトリが見つかりませんでした。"],
    ["Archive contains an empty path.", "アーカイブに空のパスが含まれています。"],
    ["Destination already exists and overwrite is false.", "保存先が既に存在し、上書きが無効なためスキップしました。"],
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

  const matchers: Array<[RegExp, (...groups: string[]) => string]> = [
    [/^Detected (\d+) skill candidate\(s\)\.$/, (count) => `${count} 件のスキル候補を検出しました。`],
    [/^(\d+) installed, (\d+) skipped, (\d+) failed$/, (installed, skipped, failed) => `${installed}件インストール / ${skipped}件スキップ / ${failed}件失敗`],
    [/^Repository: (.+)$/, (name) => `リポジトリ: ${name}`],
    [/^Snapshot ref: (.+)$/, (refName) => `取得 ref: ${refName}`],
    [/^Requested: \((all)\)$/, () => "要求対象: （すべて）"],
    [/^Requested: (.+)$/, (requested) => `要求対象: ${requested}`],
    [/^Failed to download archive: (.+)$/, (reason) => `アーカイブの取得に失敗しました: ${reason}`],
    [/^GitHub returned HTTP (.+) for (.+)$/, (status, url) => `GitHub から HTTP ${status} が返されました: ${url}`],
    [/^Scope path does not exist: (.+)$/, (path) => `指定されたスコープパスが存在しません: ${path}`],
    [/^None of requested skill names were found: (.+)$/, (names) => `指定されたスキル名が見つかりませんでした: ${names}`],
    [/^Ambiguous skill selector '(.+)'\. Use a unique path\.$/, (name) => `スキル指定 '${name}' が曖昧です。より一意なパスを指定してください。`],
    [/^Multiple selected skills would install to '(.+)'\.$/, (destination) => `複数の選択項目が同じ保存先 '${destination}' にインストールされます。`],
    [/^SKILL\.md not found in (.+)$/, (path) => `SKILL.md が見つかりません: ${path}`],
    [/^Existing path is not a directory: (.+)$/, (path) => `既存パスがディレクトリではありません: ${path}`],
    [/^Archive contains an unsupported tar member type: (.+)$/, (member) => `アーカイブに未対応の tar メンバー種別があります: ${member}`],
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
