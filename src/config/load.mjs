// Read and validate the config file. Used by every command that needs it.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { configFile, configDir } from "./paths.mjs";
import { defaultConfig, validate } from "./schema.mjs";

export class ConfigError extends Error {
  constructor(message, { code = "CONFIG_ERROR", path } = {}) {
    super(message);
    this.name = "ConfigError";
    this.code = code;
    this.path = path;
  }
}

export function configExists() {
  return existsSync(configFile());
}

export function loadConfig() {
  const path = configFile();
  if (!existsSync(path)) {
    throw new ConfigError(
      `No config found at ${path}. Run \`daily-report config\` to create one.`,
      { code: "CONFIG_MISSING", path }
    );
  }

  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch (err) {
    throw new ConfigError(
      `Could not read config at ${path}: ${err.message}`,
      { code: "CONFIG_READ", path }
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new ConfigError(
      `Config file at ${path} is not valid JSON: ${err.message}`,
      { code: "CONFIG_INVALID_JSON", path }
    );
  }

  const errors = validate(parsed);
  if (errors.length > 0) {
    throw new ConfigError(
      `Config file at ${path} is invalid:\n  - ${errors.join("\n  - ")}`,
      { code: "CONFIG_INVALID_SCHEMA", path }
    );
  }

  return parsed;
}

export function saveConfig(cfg) {
  const errors = validate(cfg);
  if (errors.length > 0) {
    throw new ConfigError(
      `Refusing to save invalid config:\n  - ${errors.join("\n  - ")}`,
      { code: "CONFIG_INVALID_SCHEMA" }
    );
  }

  const dir = configDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const path = configFile();
  writeFileSync(path, JSON.stringify(cfg, null, 2) + "\n", "utf8");
  return path;
}

export { defaultConfig };
