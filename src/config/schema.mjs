// JSON schema of the daily-report config file.
// Used by load.mjs (validation on read) and by wizard.mjs (defaults on write).

export const SCHEMA_VERSION = 1;

export function defaultConfig() {
  return {
    version: SCHEMA_VERSION,
    transport: "evolution",
    evolution: {
      url: "",
      instance: "",
      apiKey: "",
      groupId: "",
    },
    wazap: {
      url: "http://127.0.0.1:4001",
      apiKey: "",
      groupId: "",
      port: 4001,
    },
    dev: {
      gitUsername: "",
      displayName: "",
      tag: "",
      historicoDir: "",
    },
    projects: [],
    sources: {
      gitLog: { enabled: true },
      github: { enabled: false },
      todoFile: { enabled: true, path: "TODO_pending.md" },
      historico: { enabled: false, stuckHeader: "Travado" },
    },
  };
}

// Returns an array of error messages. Empty array == valid.
export function validate(cfg) {
  const errors = [];

  if (!cfg || typeof cfg !== "object") {
    return ["config must be an object"];
  }

  if (cfg.version !== SCHEMA_VERSION) {
    errors.push(
      `version must be ${SCHEMA_VERSION} (got ${JSON.stringify(cfg.version)})`
    );
  }

  if (cfg.transport !== "evolution" && cfg.transport !== "wazap") {
    errors.push(
      `transport must be "evolution" or "wazap" (got ${JSON.stringify(cfg.transport)})`
    );
  }

  for (const section of ["evolution", "wazap", "dev", "sources"]) {
    if (!cfg[section] || typeof cfg[section] !== "object") {
      errors.push(`${section} section is missing or not an object`);
    }
  }

  if (!Array.isArray(cfg.projects)) {
    errors.push("projects must be an array");
  }

  // Transport-specific requirements only enforced when that transport is active.
  if (cfg.transport === "evolution" && cfg.evolution) {
    for (const k of ["url", "instance", "apiKey"]) {
      if (typeof cfg.evolution[k] !== "string" || cfg.evolution[k] === "") {
        errors.push(`evolution.${k} is required when transport=evolution`);
      }
    }
  }

  if (cfg.transport === "wazap" && cfg.wazap) {
    for (const k of ["url", "apiKey"]) {
      if (typeof cfg.wazap[k] !== "string" || cfg.wazap[k] === "") {
        errors.push(`wazap.${k} is required when transport=wazap`);
      }
    }
  }

  return errors;
}
