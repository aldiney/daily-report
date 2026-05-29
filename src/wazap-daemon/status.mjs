// Reports whether the daemon is running and the WhatsApp connection state.
// Status is the combination of: PID file present? process alive? HTTP
// /api/status reachable? what does it say?

import { clearPid, isProcessAlive, readPid, readRuntime } from "./state.mjs";

export async function getStatus({ timeoutMs = 3000 } = {}) {
  const pid = readPid();
  if (!pid) {
    return { running: false, pid: null, http: null, reason: "no PID file" };
  }
  if (!isProcessAlive(pid)) {
    clearPid();
    return { running: false, pid: null, http: null, reason: "PID file pointed at a dead process" };
  }

  let runtime;
  try {
    runtime = readRuntime();
  } catch (err) {
    return { running: true, pid, http: null, reason: err.message };
  }

  const url = `http://127.0.0.1:${runtime.port}/api/status`;
  let response;
  try {
    response = await fetchWithTimeout(url, timeoutMs);
  } catch (err) {
    return { running: true, pid, http: null, reason: `HTTP error: ${err.message}` };
  }

  if (!response.ok) {
    return { running: true, pid, http: { status: response.status }, reason: `HTTP ${response.status}` };
  }

  let body;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  return {
    running: true,
    pid,
    http: { status: response.status, body },
  };
}

async function fetchWithTimeout(url, timeoutMs) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}
