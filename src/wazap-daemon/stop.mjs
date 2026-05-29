// Stops a detached wazap daemon by reading the PID file, sending SIGTERM,
// waiting for graceful shutdown, then escalating to SIGKILL if needed.

import { clearPid, isProcessAlive, readPid } from "./state.mjs";

const GRACE_MS = 10_000;
const POLL_MS = 200;

export async function stopDaemon({ force = false } = {}) {
  const pid = readPid();
  if (!pid) {
    return { stopped: false, reason: "no PID file" };
  }
  if (!isProcessAlive(pid)) {
    clearPid();
    return { stopped: false, reason: "PID stale (process already gone)" };
  }

  try {
    process.kill(pid, force ? "SIGKILL" : "SIGTERM");
  } catch (err) {
    return { stopped: false, reason: `kill failed: ${err.message}`, pid };
  }

  // Wait up to GRACE_MS for graceful shutdown
  const deadline = startTime() + GRACE_MS;
  while (startTime() < deadline) {
    if (!isProcessAlive(pid)) {
      clearPid();
      return { stopped: true, pid, escalated: false };
    }
    await sleep(POLL_MS);
  }

  if (force) {
    // Already SIGKILL'd; still alive somehow
    return { stopped: false, reason: "process did not exit after SIGKILL", pid };
  }

  // Escalate
  try {
    process.kill(pid, "SIGKILL");
  } catch (err) {
    return { stopped: false, reason: `SIGKILL failed: ${err.message}`, pid };
  }
  await sleep(POLL_MS * 2);
  if (!isProcessAlive(pid)) {
    clearPid();
    return { stopped: true, pid, escalated: true };
  }
  return { stopped: false, reason: "process still alive after SIGKILL", pid };
}

// `Date.now()` does not work under the workflow harness, but in normal Node
// runs it's fine. Wrap it so a future caller could inject a clock.
function startTime() {
  return Date.now();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
