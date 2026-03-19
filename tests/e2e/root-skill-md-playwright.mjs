import assert from "node:assert/strict";
import { spawn, execFile } from "node:child_process";
import { once } from "node:events";
import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { chromium } from "playwright";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const appUrl = process.env.ROOT_SKILL_APP_URL ?? "http://127.0.0.1:1420/";
const repoUrl = process.env.ROOT_SKILL_REPO_URL
  ?? "https://github.com/Sunwood-ai-labs/root-skill-md-experiment";
const repoRef = process.env.ROOT_SKILL_REPO_REF
  ?? "6617fe8eb0f5eff216488fa13df95cee0c08dcc1";
const bridgePort = Number(process.env.ROOT_SKILL_BRIDGE_PORT ?? "0");
const headless = process.env.PLAYWRIGHT_HEADLESS !== "false";
const installRoot = process.env.ROOT_SKILL_INSTALL_DIR
  ?? path.join(os.tmpdir(), `root-skill-md-playwright-${Date.now()}`);
const artifactsRoot = path.join(repoRoot, "qa", "root-skill-md-playwright");
const screenshotPath = path.join(artifactsRoot, "latest.png");
const reportPath = path.join(artifactsRoot, "latest.json");
const harnessManifest = path.join(repoRoot, "tests", "e2e", "root-skill-md-harness", "Cargo.toml");
const harnessBinary = path.join(
  repoRoot,
  "tests",
  "e2e",
  "root-skill-md-harness",
  "target",
  "debug",
  process.platform === "win32"
    ? "root_skill_md_playwright_harness.exe"
    : "root_skill_md_playwright_harness",
);

async function ensureHarnessBuilt() {
  await execFileAsync(
    "cargo",
    ["build", "--manifest-path", harnessManifest],
    {
      cwd: repoRoot,
      windowsHide: true,
    },
  );
}

async function runHarness(command, args) {
  const { stdout } = await execFileAsync(harnessBinary, [command, ...args], {
    cwd: repoRoot,
    windowsHide: true,
  });
  return JSON.parse(stdout.trim());
}

async function isServerReady(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForServer(url, timeoutMs, getDebugOutput = () => "") {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isServerReady(url)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  const debugOutput = getDebugOutput().trim();
  throw new Error(
    debugOutput
      ? `Timed out waiting for dev server at ${url}\n${debugOutput}`
      : `Timed out waiting for dev server at ${url}`,
  );
}

async function stopChild(child) {
  if (!child || child.exitCode !== null) {
    return;
  }

  if (process.platform === "win32") {
    await execFileAsync("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
      windowsHide: true,
    }).catch(() => {});
  } else {
    child.kill("SIGTERM");
  }

  await Promise.race([
    once(child, "exit").catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, 2_000)),
  ]);
}

async function closeServer(server) {
  if (!server) {
    return;
  }

  await Promise.race([
    new Promise((resolve) => server.close(resolve)),
    new Promise((resolve) => setTimeout(resolve, 2_000)),
  ]);
}

function startDevServer() {
  const child = process.platform === "win32"
    ? spawn("cmd.exe", ["/d", "/s", "/c", "npm run dev"], {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    })
    : spawn("npm", ["run", "dev"], {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

  let output = "";
  const append = (chunk) => {
    output += chunk.toString();
    if (output.length > 8000) {
      output = output.slice(-8000);
    }
  };

  child.stdout.on("data", append);
  child.stderr.on("data", append);

  return {
    child,
    getOutput: () => output,
  };
}

async function createBridgeServer(installDestination) {
  const bridgeHits = [];
  const server = createServer(async (req, res) => {
    const reply = (statusCode, payload) => {
      res.writeHead(statusCode, {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "content-type",
      });
      res.end(JSON.stringify(payload));
    };

    if (req.method === "OPTIONS") {
      reply(204, {});
      return;
    }

    if (req.method !== "POST" || req.url !== "/invoke") {
      reply(404, { error: "not found" });
      return;
    }

    try {
      let body = "";
      for await (const chunk of req) {
        body += chunk;
      }
      const { cmd, args } = JSON.parse(body);
      bridgeHits.push({ cmd, args });

      if (cmd === "inspect_repository") {
        reply(200, await runHarness("inspect", [
          args.repositoryUrl,
          args.refValue ?? "",
        ]));
        return;
      }

      if (cmd === "install_skills") {
        const selectedPaths = JSON.stringify(Array.isArray(args.selectedPaths) ? args.selectedPaths : []);
        const installArgs = [
          args.repositoryUrl,
          args.destination ?? installDestination,
          String(Boolean(args.overwrite)),
          selectedPaths,
          args.refValue ?? "",
        ];
        reply(200, await runHarness("install", installArgs));
        return;
      }

      reply(400, { error: `unsupported command: ${cmd}` });
    } catch (error) {
      reply(500, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(bridgePort, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Bridge server did not expose a numeric port");
  }
  return { server, bridgeHits, port: address.port };
}

async function installInitScript(context, installDestination, port) {
  await context.addInitScript(
    ({ bridgePort, destination }) => {
      window.localStorage.setItem("codex-skill-forge.locale", "en");

      const callbacks = new Map();
      const eventListeners = new Map();
      let isMaximized = false;

      function registerCallback(callback, once = false) {
        const id = window.crypto.getRandomValues(new Uint32Array(1))[0];
        callbacks.set(id, (payload) => {
          if (once) {
            callbacks.delete(id);
          }
          return callback?.(payload);
        });
        return id;
      }

      function runCallback(id, payload) {
        const callback = callbacks.get(id);
        if (callback) {
          callback(payload);
        }
      }

      function unregisterListener(event, id) {
        const listeners = eventListeners.get(event) ?? [];
        eventListeners.set(
          event,
          listeners.filter((item) => item !== id),
        );
        callbacks.delete(id);
      }

      function emitResize() {
        const listeners = eventListeners.get("tauri://resize") ?? [];
        for (const handlerId of listeners) {
          runCallback(handlerId, {
            event: "tauri://resize",
            id: handlerId,
            payload: {},
          });
        }
      }

      window.__TAURI_INTERNALS__ = window.__TAURI_INTERNALS__ ?? {};
      window.__TAURI_EVENT_PLUGIN_INTERNALS__ = window.__TAURI_EVENT_PLUGIN_INTERNALS__ ?? {};

      window.__TAURI_INTERNALS__.metadata = {
        currentWindow: { label: "main" },
        currentWebview: { label: "main", windowLabel: "main" },
      };
      window.__TAURI_INTERNALS__.callbacks = callbacks;
      window.__TAURI_INTERNALS__.transformCallback = registerCallback;
      window.__TAURI_INTERNALS__.unregisterCallback = (id) => callbacks.delete(id);
      window.__TAURI_INTERNALS__.runCallback = runCallback;
      window.__TAURI_INTERNALS__.convertFileSrc = (filePath, protocol = "asset") =>
        `http://${protocol}.localhost/${encodeURIComponent(filePath)}`;
      window.__TAURI_EVENT_PLUGIN_INTERNALS__.unregisterListener = unregisterListener;

      window.__TAURI_INTERNALS__.invoke = async (cmd, args = {}) => {
        if (cmd === "default_destination" || cmd === "pick_destination") {
          return destination;
        }

        if (cmd === "inspect_repository" || cmd === "install_skills") {
          const response = await fetch(`http://127.0.0.1:${bridgePort}/invoke`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({ cmd, args }),
          });
          const payload = await response.json();
          if (!response.ok) {
            throw new Error(payload.error ?? `bridge failed for ${cmd}`);
          }
          return payload;
        }

        if (cmd === "plugin:event|listen") {
          const listeners = eventListeners.get(args.event) ?? [];
          listeners.push(args.handler);
          eventListeners.set(args.event, listeners);
          return args.handler;
        }

        if (cmd === "plugin:event|unlisten") {
          unregisterListener(args.event, args.eventId ?? args.id);
          return null;
        }

        if (cmd === "plugin:window|is_maximized") {
          return isMaximized;
        }

        if (cmd === "plugin:window|toggle_maximize") {
          isMaximized = !isMaximized;
          emitResize();
          return null;
        }

        if (cmd.startsWith("plugin:window|")) {
          return null;
        }

        return null;
      };
    },
    {
      bridgePort: port,
      destination: installDestination,
    },
  );
}

async function pathExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  let browser;
  let context;
  let page;
  let server;
  let startedDevServer = null;
  let bridge = null;

  await mkdir(artifactsRoot, { recursive: true });
  await rm(installRoot, { recursive: true, force: true });
  await ensureHarnessBuilt();
  console.log(`root-skill-md Playwright smoke starting: ${repoUrl} @ ${repoRef}`);

  try {
    if (!(await isServerReady(appUrl))) {
      console.log(`starting dev server: ${appUrl}`);
      startedDevServer = startDevServer();
      await waitForServer(appUrl, 30_000, startedDevServer.getOutput);
    }
    console.log(`dev server ready: ${appUrl}`);

    bridge = await createBridgeServer(installRoot);
    server = bridge.server;
    console.log(`bridge ready: http://127.0.0.1:${bridge.port}/invoke`);

    browser = await chromium.launch({ headless });
    console.log(`browser launched (${headless ? "headless" : "headed"})`);
    context = await browser.newContext({
      viewport: { width: 1600, height: 980 },
    });
    await installInitScript(context, installRoot, bridge.port);

    page = await context.newPage();
    await page.goto(appUrl, { waitUntil: "domcontentloaded" });
    console.log("app loaded");
    const repositoryInput = page.getByLabel("GitHub URL");
    const refInput = page.locator("#ref-override");
    const destinationInput = page.locator("#destination-input");
    await repositoryInput.waitFor({ state: "visible" });
    await repositoryInput.fill(repoUrl);
    assert.equal(await repositoryInput.inputValue(), repoUrl);
    await refInput.fill(repoRef);
    assert.equal(await refInput.inputValue(), repoRef);
    await destinationInput.waitFor({ state: "visible" });
    await page.waitForFunction(
      ({ expectedDestination }) => {
        const input = document.querySelector("#destination-input");
        return input instanceof HTMLInputElement && input.value === expectedDestination;
      },
      { expectedDestination: installRoot },
    );
    assert.equal(await destinationInput.inputValue(), installRoot);
    console.log("setup inputs ready");

    await page.getByRole("button", { name: "Inspect" }).click();
    await page.locator(".candidate-list").waitFor({ state: "visible" });
    console.log("inspect completed");

    const candidateCard = page.locator(".candidate-card", {
      has: page.getByText("root-skill-md-experiment", { exact: true }),
    }).first();
    const candidateSummary = await candidateCard.innerText();
    assert.match(candidateSummary, /root-skill-md-experiment/);
    assert.match(candidateSummary, /^\s*01/m);
    assert.match(candidateSummary, /^\s*\.\s*$/m);
    assert.match(candidateSummary, /skill\.md/);

    await candidateCard.locator("input[type='checkbox']").check();
    await page.locator("#workspace-tab-setup").click();
    await page.getByRole("button", { name: "Install selected" }).click();

    const dialogCard = page.locator(".dialog-card");
    await dialogCard.waitFor({ state: "visible" });
    await dialogCard.getByText("1 installed, 0 skipped, 0 failed", { exact: true }).waitFor({ state: "visible" });
    console.log("install completed");

    const dialogText = await dialogCard.innerText();
    const transcriptText = await page.locator(".log-ledger").innerText();
    const manifestPath = path.join(installRoot, "root-skill-md-experiment", "skill.md");
    const referencePath = path.join(
      installRoot,
      "root-skill-md-experiment",
      "references",
      "hello.md",
    );

    assert.match(dialogText, /Install completed/);
    assert.match(dialogText, /1 installed, 0 skipped, 0 failed/);
    assert.ok(await pathExists(manifestPath), `Missing installed manifest: ${manifestPath}`);
    assert.ok(await pathExists(referencePath), `Missing installed reference: ${referencePath}`);

    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
      type: "png",
    });

    const report = {
      repoUrl,
      repoRef,
      appUrl,
      installRoot,
      bridgeHits: bridge.bridgeHits.map((item) => item.cmd),
      candidateSummary,
      dialogText,
      transcriptTail: transcriptText.split("\n").slice(-12),
      manifestPath,
      referencePath,
      screenshotPath,
      timestamp: new Date().toISOString(),
    };

    await writeFile(reportPath, JSON.stringify(report, null, 2));

    console.log("root-skill-md Playwright smoke passed");
    console.log(`report: ${reportPath}`);
    console.log(`screenshot: ${screenshotPath}`);
    console.log(`install root: ${installRoot}`);
  } finally {
    await page?.close().catch(() => {});
    await context?.close().catch(() => {});
    await browser?.close().catch(() => {});
    await closeServer(server).catch(() => {});
    if (startedDevServer) {
      await stopChild(startedDevServer.child);
    }
  }
}

const keepAlive = setInterval(() => {}, 1_000);

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
} finally {
  clearInterval(keepAlive);
}
