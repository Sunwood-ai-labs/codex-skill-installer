# Codex Skill Installer Docs

<p align="center">
  <img src="../brand/codex-skill-installer-mark.svg" alt="Codex Skill Installer のマーク" width="120">
</p>

<p align="center">
  Codex skills を GitHub からローカルへ install するデスクトップアプリの、レビュー重視ドキュメントです。
</p>

日本語 · [English](../index.md)

## このページで分かること

この docs は、公開 README の内容をそのまま広げた入口です。コードを追わなくても、アプリの流れと画面構成を短時間でつかめるようにしています。

## 入口

- [UI ツアー](ui-tour.md)
- [英語版 docs トップ](../index.md)
- [GitHub リポジトリ](https://github.com/Sunwood-ai-labs/codex-skill-installer)

## この docs で確認できること

- `Setup` / `Shortlist` / `Transcript` を軸にしたレビュー重視フロー
- Codex skills の既定インストール先
- フロントエンド、docs、デスクトップパッケージの検証コマンド
- 英日 2 ロケールのドキュメント導線

## スクリーンショットについて

追跡済みスクリーンショットは、VitePress が安定した site asset として配布できるよう、[UI ツアー](ui-tour.md) と [英語版 UI ツアー](../ui-tour.md) に埋め込んでいます。

## よく使うパス

- 既定の install 先: `CODEX_HOME/skills` または `~/.codex/skills`
- Production build: `npm run tauri build`
- フロントエンド確認: `npm run build`
