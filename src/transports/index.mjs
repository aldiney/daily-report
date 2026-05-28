// Transport factory. `getTransport(config)` returns an object with at least:
//
//   { name: string, sendText({to, text}) -> Promise<{httpStatus,...}>,
//     listGroups?: () -> Promise<Array<{id, name}>> | null }
//
// New transports plug in by adding a case here and a sibling module.

import { create as createEvolution } from "./evolution.mjs";

export function getTransport(config) {
  if (!config || typeof config !== "object") {
    throw new Error("getTransport: config is required");
  }
  switch (config.transport) {
    case "evolution":
      return createEvolution(config.evolution);
    case "wazap":
      // v1.1 adds the Wazap transport. The schema accepts wazap as a value
      // already so v1.0 users with old configs do not break.
      throw new Error(
        "Transport 'wazap' is not available in this version. Use --transport evolution or upgrade."
      );
    default:
      throw new Error(
        `Unknown transport: ${JSON.stringify(config.transport)}. Expected "evolution" or "wazap".`
      );
  }
}
