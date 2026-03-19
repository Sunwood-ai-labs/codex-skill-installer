# Codex Skill Installer UI Tour

<p align="center">
  <img src="../brand/codex-skill-installer-mark.svg" alt="Codex Skill Installer のマーク" width="120">
</p>

<p align="center">
  デスクトップ画面の流れを、`Setup` / `Shortlist` / `Transcript` の順で整理した案内です。
</p>

日本語 · [English](../ui-tour.md)

## Tabs

アプリは 3 つのトップレベルタブで構成されています。

- `Setup`: repository URL、ref override、destination、overwrite を先に決めて inspect します。
- `Shortlist`: 検出された skill の候補を確認し、install するものだけを選びます。
- `Transcript`: inspect と install の履歴を 1 か所に残します。

タイトルバーには永続化された言語切り替えがあり、英語と日本語を切り替えても作業の流れは変わりません。custom title bar は window 枠にぴったり沿うように配置されています。

## Setup

`Setup` タブは入力の起点です。source と destination をそろえてから inspect し、shortlist を作る前に前提を確認できます。

英語:

![英語版 Setup タブ](../screenshots/setup-bilingual-en-1280x820.png)

日本語:

![日本語版 Setup タブ](../screenshots/setup-bilingual-ja-1280x820.png)

## Shortlist

`Shortlist` タブはレビューを主役にした画面です。大量投入の一覧ではなく、選別用の台帳として使います。

![Shortlist タブ](../screenshots/shortlist-1280x820.png)

## Transcript

`Transcript` タブは、非同期の inspect / install を追いやすい ledger です。処理中でも何が起きたかを見失いません。

![Transcript タブ](../screenshots/transcript-1280x820.png)

## 検証メモ

このスクリーンショットは `2026-03-19` 時点のアプリから取得しました。確認した変更点は、タブ化された desktop layout、フラットな title bar chrome、ロケール別の typography 調整、compact-height の scaling、そして bilingual UI です。

実行したチェック:

- `npm run build`
- `npm run tauri dev`
- `1280x820` での renderer screenshot 取得。英語と日本語の `Setup` を含みます。

