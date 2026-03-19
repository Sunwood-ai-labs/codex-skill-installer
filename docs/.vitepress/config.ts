import { fileURLToPath } from "node:url";

import { defineConfig } from "vitepress";

const repoPath = "/codex-skill-installer/";
const repositoryUrl = "https://github.com/Sunwood-ai-labs/codex-skill-installer";
const brandMark = "/brand/codex-skill-installer-mark.svg";
const brandMarkWithBase = `${repoPath}brand/codex-skill-installer-mark.svg`;

export default defineConfig({
  base: repoPath,
  cleanUrls: true,
  lastUpdated: true,
  title: "Codex Skill Installer",
  description: "Desktop app for reviewing and installing Codex skills from GitHub repositories.",
  vite: {
    resolve: {
      alias: {
        brand: fileURLToPath(new URL("../brand", import.meta.url)),
        screenshots: fileURLToPath(new URL("../screenshots", import.meta.url)),
      },
    },
  },
  head: [
    ["meta", { name: "theme-color", content: "#a45e37" }],
    ["meta", { name: "author", content: "Sunwood-ai-labs" }],
    ["link", { rel: "icon", href: brandMarkWithBase, type: "image/svg+xml" }],
  ],
  themeConfig: {
    logo: brandMark,
    socialLinks: [{ icon: "github", link: repositoryUrl }],
    footer: {
      message: "Review-first desktop tooling for Codex skill installation.",
      copyright: "Copyright © Sunwood-ai-labs",
    },
  },
  locales: {
    root: {
      label: "English",
      lang: "en-US",
      title: "Codex Skill Installer Docs",
      description: "Review-first docs for the desktop app that installs Codex skills from GitHub.",
      themeConfig: {
        nav: [
          { text: "Guide", link: "/" },
          { text: "UI Tour", link: "/ui-tour" },
          { text: "日本語", link: "/ja/" },
        ],
        sidebar: {
          "/": [
            {
              text: "Overview",
              items: [
                { text: "Docs landing", link: "/" },
                { text: "UI tour", link: "/ui-tour" },
              ],
            },
          ],
          "/ja/": [
            {
              text: "Japanese",
              items: [
                { text: "ドキュメントの入り口", link: "/ja/" },
                { text: "UI ツアー", link: "/ja/ui-tour" },
              ],
            },
          ],
        },
      },
    },
    ja: {
      label: "日本語",
      lang: "ja-JP",
      title: "Codex Skill Installer ドキュメント",
      description: "GitHub から Codex skills を取り込むデスクトップアプリのレビューファーストなドキュメント。",
      themeConfig: {
        nav: [
          { text: "概要", link: "/ja/" },
          { text: "UI ツアー", link: "/ja/ui-tour" },
          { text: "English", link: "/" },
        ],
        sidebar: {
          "/ja/": [
            {
              text: "概要",
              items: [
                { text: "ドキュメントの入り口", link: "/ja/" },
                { text: "UI ツアー", link: "/ja/ui-tour" },
              ],
            },
          ],
          "/": [
            {
              text: "English",
              items: [
                { text: "Docs landing", link: "/" },
                { text: "UI tour", link: "/ui-tour" },
              ],
            },
          ],
        },
      },
    },
  },
});
