// Transport: local Wazap gateway (whatsapp-web.js + Express, running on
// 127.0.0.1 under <configDir>/wazap/). The transport does NOT start or
// install the gateway - those are `daily-report install-wazap` and
// `daily-report wazap start` concerns. It only speaks HTTP.

import { readRuntime } from "../wazap-daemon/state.mjs";

export const describe =
  "Transport that talks to a locally running Wazap gateway over HTTP.";

export function create(cfg) {
  // Prefer values from the on-disk runtime file (written by install-wazap)
  // because that's the source of truth for the actually running daemon.
  // Fall back to the user config for forward compatibility.
  let runtime;
  try {
    runtime = readRuntime();
  } catch (err) {
    throw new Error(
      `Cannot initialize Wazap transport: ${err.message}`
    );
  }
  const port = runtime.port || cfg?.port || 4001;
  const apiKey = runtime.apiKey || cfg?.apiKey || "";
  const baseUrl = cfg?.url && cfg.url.trim() !== ""
    ? cfg.url.replace(/\/+$/, "")
    : `http://127.0.0.1:${port}`;

  const headers = {
    "Content-Type": "application/json",
    ...(apiKey ? { "X-API-Key": apiKey } : {}),
  };

  return {
    name: "wazap",
    async sendText({ to, text }) {
      if (!to) throw new Error("wazap.sendText: missing recipient `to`");
      if (!text) throw new Error("wazap.sendText: missing message `text`");

      let response;
      try {
        response = await fetch(`${baseUrl}/api/send/text`, {
          method: "POST",
          headers,
          body: JSON.stringify({ to, message: text }),
        });
      } catch (err) {
        throw new TransportError(
          `network error calling Wazap at ${baseUrl}: ${err.message}`,
          { cause: err }
        );
      }

      const body = await response.text();
      if (!response.ok) {
        throw new TransportError(
          `Wazap returned HTTP ${response.status}: ${body.slice(0, 500)}`
        );
      }
      return { httpStatus: response.status, raw: body };
    },
    async listGroups() {
      let response;
      try {
        response = await fetch(`${baseUrl}/api/groups`, { headers });
      } catch (err) {
        throw new TransportError(
          `network error calling Wazap at ${baseUrl}: ${err.message}`,
          { cause: err }
        );
      }
      if (!response.ok) {
        const body = await response.text();
        throw new TransportError(
          `Wazap returned HTTP ${response.status}: ${body.slice(0, 500)}`
        );
      }
      return await response.json();
    },
  };
}

export class TransportError extends Error {
  constructor(message, opts) {
    super(message, opts);
    this.name = "TransportError";
  }
}
