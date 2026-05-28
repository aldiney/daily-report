// Transport: Evolution API (https://github.com/EvolutionAPI/evolution-api).
//
// Reads credentials from the user config (cfg.evolution) and exposes a single
// `sendText({ to, text })` operation. The transport does NOT validate or
// fall back to the default group itself - that decision lives in the CLI
// `send` command, which knows how to combine `--to` overrides with
// `cfg.evolution.groupId`.

export const describe =
  "Transport that talks to a remote Evolution API instance over HTTP.";

export function create(cfg) {
  if (!cfg || typeof cfg !== "object") {
    throw new Error("evolution transport requires the evolution config block");
  }
  const url = (cfg.url || "").trim();
  const instance = (cfg.instance || "").trim();
  const apiKey = (cfg.apiKey || "").trim();

  if (!url || !instance || !apiKey) {
    throw new Error(
      "evolution transport requires url, instance, and apiKey in config.evolution"
    );
  }
  if (!/^https?:\/\//i.test(url)) {
    throw new Error(
      `evolution.url must start with http:// or https:// (got: "${url}")`
    );
  }

  const endpoint = `${url.replace(/\/+$/, "")}/message/sendText/${instance}`;

  return {
    name: "evolution",
    async sendText({ to, text }) {
      if (!to) throw new Error("evolution.sendText: missing recipient `to`");
      if (!text) throw new Error("evolution.sendText: missing message `text`");

      let response;
      try {
        response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: apiKey,
          },
          body: JSON.stringify({ number: to, text }),
        });
      } catch (err) {
        throw new TransportError(
          `network error calling Evolution at ${endpoint}: ${err.message}`,
          { cause: err }
        );
      }

      const responseBody = await response.text();
      if (!response.ok) {
        throw new TransportError(
          `Evolution returned HTTP ${response.status}: ${responseBody.slice(0, 500)}`
        );
      }
      return { httpStatus: response.status, raw: responseBody };
    },
    // Evolution does not expose a group-listing endpoint that fits this
    // signature. Group discovery for Evolution is done out-of-band (web UI of
    // the instance). The CLI surfaces a friendly error.
    listGroups: null,
  };
}

export class TransportError extends Error {
  constructor(message, opts) {
    super(message, opts);
    this.name = "TransportError";
  }
}
