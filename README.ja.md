<p align="center">
  <img src="docs/brand/codex-skill-installer-mark.svg" alt="Codex Skill Installer のマーク" width="128">
</p>

<h1 align="center">Codex Skill Installer</h1>

<p align="center">
  GitHub リポジトリの skill を、レビュー重視のデスクトップフローでローカルの Codex skills ディレクトリへインストールします。
</p>

<p align="center">
  日本語 · <a href="README.md">English</a>
</p>

<p align="center">
  <a href="https://github.com/Sunwood-ai-labs/codex-skill-installer/actions/workflows/build-desktop.yml">
    <img alt="Desktop build" src="https://github.com/Sunwood-ai-labs/codex-skill-installer/actions/workflows/build-desktop.yml/badge.svg?branch=main">
  </a>
  <a href="https://github.com/Sunwood-ai-labs/codex-skill-installer/actions/workflows/deploy-docs.yml">
    <img alt="Docs deploy" src="https://github.com/Sunwood-ai-labs/codex-skill-installer/actions/workflows/deploy-docs.yml/badge.svg?branch=main">
  </a>
  <a href="LICENSE">
    <img alt="MIT license" src="https://img.shields.io/badge/license-MIT-172129.svg">
  </a>
</p>

Codex Skill Installer は、React + TypeScript のフロントエンドと Rust コアを持つ Tauri 2 デスクトップアプリです。GitHub から Codex への既存ワークフローを保ちながら、インストール前に内容を確認しやすい落ち着いた画面に整えています。

## ✨ 特徴

- GitHub リポジトリ、`tree`、`blob` の URL を貼り付けて、skill manifest（`SKILL.md` または `skill.md`）を含むフォルダを検出できます。
- 検出結果は専用のショートリストで確認してから、インストール対象を選べます。
- 選択した skill を、上書きの有無を切り替えながらローカルの Codex skills ディレクトリへインストールできます。
- `Setup`、`Shortlist`、`Transcript` の 3 つのトップレベルタブで作業できます。
- カスタムタイトルバーの言語トグルで、英語と日本語を切り替えられます。

## 🚀 クイックスタート

```powershell
npm install
npm run tauri dev
```

## 🧭 使い方

1. GitHub の repository、`tree`、`blob` URL を入力します。
2. 必要なら `Ref override` で別の branch や tag を指定します。
3. Codex skills のインストール先フォルダを選びます。
4. リポジトリを inspect して shortlist を確認し、必要な skill だけを install します。

## 📁 既定のインストール先

Codex の一般的な skills 配置に従います。

- `CODEX_HOME` が設定されている場合は `CODEX_HOME/skills`
- Windows のフォールバック: `%USERPROFILE%\.codex\skills`
- macOS / Linux のフォールバック: `~/.codex/skills`

## 🖼️ スクリーンショット

現在のデスクトップシェルは、フラットな custom title bar、ロケール対応のタイポグラフィ、`1280x820` 付近でも読みやすい compact-height レイアウトを備えています。

英語版 `Setup`:

![英語版 Setup タブ](docs/screenshots/setup-bilingual-en-1280x820.png)

日本語版 `Setup`:

![日本語版 Setup タブ](docs/screenshots/setup-bilingual-ja-1280x820.png)

Shortlist:

![Shortlist タブ](docs/screenshots/shortlist-1280x820.png)

Transcript:

![Transcript タブ](docs/screenshots/transcript-1280x820.png)

## 📚 ドキュメント

- [Docs ランディングページ](docs/index.md)
- [UI ツアー](docs/ui-tour.md)
- [日本語版 Docs ランディングページ](docs/ja/index.md)
- [日本語版 UI ツアー](docs/ja/ui-tour.md)

## 🛠️ 検証

- フロントエンドの build と typecheck: `npm run build`
- Rust の unit test: `cargo test --manifest-path src-tauri/Cargo.toml`
- 公開中の直下 `skill.md` fixture repo を使う Browser Playwright スモーク: `npm run test:e2e:root-skill-md`
- UI の根拠: `docs/screenshots/` 配下の追跡済みスクリーンショット。英語と日本語の `Setup` は `1280x820` で確認済みです。

## 📦 Production Build

```powershell
npm run tauri build
```

出力は `src-tauri/target/release/bundle/` に作成されます。

## 🔧 リポジトリメモ

- GitHub archive の download と extraction はブラウザではなく Rust 側で行います。
- 安全でない archive path は extraction 時に拒否します。
- install 結果は `installed / skipped / failed` のモデルを保持します。
- folder picker は Tauri の host 側で呼び出す native dialog です。
- locale の選択は local storage に保存されるため、再起動後も言語設定が維持されます。
- GitHub Actions は `.github/workflows/build-desktop.yml` から Windows / macOS / Linux の bundle を build します。
