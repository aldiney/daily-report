// Transport factory. `getTransport(config)` returns an object with at least:
//
//   { name: string, sendText({to, text}) -> Promise<{httpStatus,...}>,
//     listGroups?: () -> Promise<Array<{id, name}>> | null }
//
// New transports plug in by adding a case here and a sibling module.

import { create as createEvolution } from "./evolution.mjs";
import { create as createWazap } from "./wazap.mjs";

export function getTransport(config) {
  if (!config || typeof config !== "object") {
    throw new Error("getTransport: config is required");
  }
  switch (config.transport) {
    case "evolution":
      return createEvolution(config.evolution);
    case "wazap":
      return createWazap(config.wazap);
    default:
      throw new Error(
        `Unknown transport: ${JSON.stringify(config.transport)}. Expected "evolution" or "wazap".`
      );
  }
}
