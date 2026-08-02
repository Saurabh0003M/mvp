// ============================================================================
// One command to run the demo.  ->  npm start
// ----------------------------------------------------------------------------
// Replaces the "kill the stale PID, start next dev, remember to stop it" dance:
//   1. frees the port if something is already squatting on it
//   2. starts Next
//   3. opens the browser once the server actually answers
//   4. shuts the server down cleanly on Ctrl+C / terminal close
//
// On "auto-close when the tab closes": a browser tab can't reliably kill a
// server it didn't start (unload events are best-effort and don't fire on
// crash), so anything built on that leaves orphan processes — which is the
// problem we're trying to remove. Ctrl+C here is guaranteed; that's the trade.
// ============================================================================

import { spawn, execSync } from "node:child_process";

const PORT = process.argv[2] || "3000";

function freePort(port) {
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, {
      stdio: ["ignore", "pipe", "ignore"],
      shell: "cmd.exe",
    }).toString();
    const pids = new Set(
      out
        .split(/\r?\n/)
        .filter((l) => l.includes("LISTENING"))
        .map((l) => l.trim().split(/\s+/).pop())
        .filter((p) => p && p !== "0")
    );
    for (const pid of pids) {
      try {
        execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
        console.log(`  freed port ${port} (was pid ${pid})`);
      } catch {}
    }
  } catch {
    /* nothing on the port — fine */
  }
}

async function waitForServer(url, timeoutMs = 60000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const r = await fetch(url);
      if (r.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

console.log(`\nAscend — starting on :${PORT}\n`);
freePort(PORT);

const child = spawn("npx", ["next", "dev", "-p", PORT], {
  stdio: "inherit",
  shell: true,
});

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("\nShutting down…");
  try {
    // Kill the whole tree — `next dev` spawns workers that outlive the parent.
    execSync(`taskkill /F /T /PID ${child.pid}`, { stdio: "ignore" });
  } catch {}
  freePort(PORT);
  process.exit(0);
}

for (const sig of ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"]) {
  process.on(sig, shutdown);
}
process.on("exit", () => {
  if (!shuttingDown) {
    try {
      execSync(`taskkill /F /T /PID ${child.pid}`, { stdio: "ignore" });
    } catch {}
  }
});
child.on("exit", (code) => {
  if (!shuttingDown) {
    console.log(`\nnext dev exited (${code}).`);
    process.exit(code ?? 0);
  }
});

const url = `http://localhost:${PORT}`;
if (await waitForServer(url)) {
  spawn("cmd", ["/c", "start", "", url], { stdio: "ignore", detached: true });
  console.log(`\n  ✓ ${url} — opened in your browser`);
  console.log(`  Press Ctrl+C here to stop the server.\n`);
} else {
  console.log(`\n  ! server didn't answer on ${url} in time.\n`);
}
