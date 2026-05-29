// daily-report install-wazap [--force]
//
// Copies wazap-host/ into <configDir>/wazap/ and runs `npm install` there.
// `npm install` is what actually downloads Chromium (~170 MB) into
// <configDir>/wazap/node_modules/puppeteer/. The whole tree stays outside of
// node_modules/daily-report/ so that future `npm i -g daily-report` upgrades
// never wipe the WhatsApp session.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, copyFileSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

import { wazapDir } from "../config/paths.mjs";
import { ensureWazapDir, runtimeFile, writeRuntime } from "../wazap-daemon/state.mjs";
import { loadConfig, saveConfig } from "../config/load.mjs";

const __filename = fileURLToPath(import.meta.url);
const SOURCE_DIR = resolve(dirname(__filename), "..", "..", "wazap-host");
const DEFAULT_PORT = 4001;

export const describe =
  "Install or reinstall the local Wazap gateway under <configDir>/wazap/.";

export async function run(args) {
  const opts = parseArgs(args);
  if (opts.help) {
    printHelp();
    return 0;
  }

  if (!existsSync(SOURCE_DIR)) {
    process.stderr.write(
      `wazap-host source not found at ${SOURCE_DIR}.\n` +
      `Re-clone the daily-report package; this command requires the bundled gateway sources.\n`
    );
    return 70; // EX_SOFTWARE
  }

  // Linux pre-flight: check libs required by puppeteer's Chromium. We do not
  // install them - this is the user's call. We just surface a clear message
  // before `npm install` downloads 170 MB only to fail at first start.
  const missing = process.platform === "linux" ? checkLinuxLibs() : [];
  if (missing.length > 0) {
    process.stderr.write(
      [
        "Linux dependencies for Chromium are missing.",
        "Install them and re-run \`daily-report install-wazap\`:",
        "  Debian/Ubuntu:  sudo apt install " + missing.join(" "),
        "  Fedora/RHEL:    sudo dnf install " + missing.map(toRpm).filter(Boolean).join(" "),
        "",
        "If you already have a system Chromium/Chrome you want to reuse, set",
        "PUPPETEER_EXECUTABLE_PATH=/path/to/chrome before running \`wazap start\`.",
      ].join("\n") + "\n"
    );
    return 1;
  }

  const dest = ensureWazapDir();

  if (opts.force) {
    process.stdout.write(`Cleaning ${dest}...\n`);
    cleanForReinstall(dest);
  }

  process.stdout.write(`Copying gateway sources to ${dest}\n`);
  copyTree(SOURCE_DIR, dest, {
    skipNames: new Set(["node_modules", ".wwebjs_auth", ".wwebjs_cache", "wazap.pid", "wazap.log", "wazap.json"]),
  });

  process.stdout.write(`Running npm install (this downloads Chromium, ~170MB)\n`);
  const npm = spawnSync("npm", ["install", "--no-audit", "--no-fund"], {
    cwd: dest,
    stdio: "inherit",
    env: process.env,
  });
  if (npm.status !== 0) {
    process.stderr.write(`\nnpm install failed with exit code ${npm.status}.\n`);
    return npm.status ?? 1;
  }

  // Generate/keep runtime descriptor with port + apiKey
  let runtime;
  try {
    runtime = readExistingRuntime();
  } catch {
    runtime = null;
  }
  if (!runtime || opts.force) {
    runtime = {
      port: DEFAULT_PORT,
      apiKey: generateApiKey(),
    };
    writeRuntime(runtime);
    process.stdout.write(`Generated wazap runtime config at ${runtimeFile()}\n`);
  }

  // Update the user config with defaults so the Wazap transport works
  // out-of-box when transport is switched.
  try {
    const cfg = loadConfig();
    cfg.wazap = cfg.wazap || {};
    cfg.wazap.port = runtime.port;
    cfg.wazap.apiKey = runtime.apiKey;
    cfg.wazap.url = `http://127.0.0.1:${runtime.port}`;
    saveConfig(cfg);
    process.stdout.write(`Updated user config with wazap.url/port/apiKey.\n`);
  } catch {
    // No config yet? Skip silently; `daily-report config` will pick up the
    // runtime values later (the wizard reads runtimeFile() if present).
  }

  process.stdout.write(
    [
      "",
      "Wazap installed.",
      "Next steps:",
      "  1. daily-report wazap start          # foreground: scan the QR code with your WhatsApp",
      "  2. (after the daemon prints \"Client ready\")",
      "  3. daily-report wazap groups         # pick the destination group",
      "  4. daily-report config               # switch transport to \"wazap\" if you want it as default",
      "",
    ].join("\n") + "\n"
  );
  return 0;
}

function parseArgs(argv) {
  const out = { force: false, help: false };
  for (const a of argv) {
    if (a === "--force" || a === "-f") out.force = true;
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

function printHelp() {
  process.stdout.write(
    [
      "Usage: daily-report install-wazap [--force]",
      "",
      `Copies the bundled wazap-host/ into ${wazapDir()} and runs \`npm install\``,
      "there. Downloads Chromium via puppeteer (~170 MB) into that folder.",
      "",
      "Options:",
      "  --force, -f    Wipe node_modules and runtime config before reinstalling",
      "                 (does NOT delete the WhatsApp session in .wwebjs_auth/)",
      "  --help, -h     Show this help",
      "",
    ].join("\n")
  );
}

// ===== helpers =====

function checkLinuxLibs() {
  // Subset known to break Chromium on minimal Debian/Ubuntu images. We test
  // by looking for the .so files; missing means apt can install them.
  const required = [
    { lib: "libnss3.so",      pkg: "libnss3" },
    { lib: "libatk-1.0.so.0", pkg: "libatk1.0-0" },
    { lib: "libatk-bridge-2.0.so.0", pkg: "libatk-bridge2.0-0" },
    { lib: "libgtk-3.so.0",   pkg: "libgtk-3-0" },
    { lib: "libasound.so.2",  pkg: "libasound2" },
    { lib: "libxshmfence.so.1", pkg: "libxshmfence1" },
  ];
  const missing = [];
  for (const { lib, pkg } of required) {
    if (!hasLib(lib)) missing.push(pkg);
  }
  return missing;
}

function hasLib(soName) {
  // ldconfig -p prints "  libfoo.so (libc6,...) => /usr/lib/.../libfoo.so"
  const res = spawnSync("ldconfig", ["-p"], { encoding: "utf8" });
  if (res.status !== 0 || !res.stdout) return true; // ldconfig missing? skip pre-flight
  return res.stdout.split("\n").some((line) => line.trim().startsWith(soName));
}

function toRpm(deb) {
  // very rough debian -> fedora mapping; missing means user adapts.
  const map = {
    "libnss3": "nss",
    "libatk1.0-0": "atk",
    "libatk-bridge2.0-0": "at-spi2-atk",
    "libgtk-3-0": "gtk3",
    "libasound2": "alsa-lib",
    "libxshmfence1": "libxshmfence",
  };
  return map[deb];
}

function copyTree(src, dest, { skipNames }) {
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    if (skipNames?.has(entry.name)) continue;
    const s = join(src, entry.name);
    const d = join(dest, entry.name);
    if (entry.isDirectory()) {
      if (!existsSync(d)) mkdirSync(d, { recursive: true });
      copyTree(s, d, { skipNames });
    } else if (entry.isFile()) {
      copyFileSync(s, d);
    }
  }
}

function cleanForReinstall(dest) {
  const removable = ["node_modules", "package-lock.json", "wazap.json"];
  for (const name of removable) {
    const p = join(dest, name);
    if (existsSync(p)) {
      rmSync(p, { recursive: true, force: true });
    }
  }
}

function readExistingRuntime() {
  const p = runtimeFile();
  if (!existsSync(p)) throw new Error("no runtime");
  return JSON.parse(readFileSync(p, "utf8"));
}

function generateApiKey() {
  return randomBytes(24).toString("hex");
}
