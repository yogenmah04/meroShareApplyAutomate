import { spawn, ChildProcess } from "child_process";
import * as path from "path";

const SCRIPT_CWD = path.resolve(__dirname);
let restartCount = 0;
let child: ChildProcess | null = null;
let isShuttingDown = false;

function startProcess() {
  if (isShuttingDown) return;

  console.log(
    `\n[${new Date().toLocaleString()}] [SUPERVISOR] Launching "npm run watch-sheets" (Restart count: ${restartCount})...`,
  );

  child = spawn("npm", ["run", "watch-sheets"], {
    cwd: SCRIPT_CWD,
    stdio: "inherit",
    shell: true,
  });

  child.on("exit", (code, signal) => {
    child = null;
    if (isShuttingDown) {
      console.log(`[${new Date().toLocaleString()}] [SUPERVISOR] Process exited cleanly during shutdown.`);
      return;
    }

    restartCount++;
    const delayMs = Math.min(5000 * Math.min(restartCount, 6), 30000);
    console.error(
      `\n[${new Date().toLocaleString()}] [SUPERVISOR] "npm run watch-sheets" exited with code=${code}, signal=${signal}.`,
    );
    console.log(`[${new Date().toLocaleString()}] [SUPERVISOR] Automatically restarting in ${delayMs / 1000}s...`);

    setTimeout(() => {
      startProcess();
    }, delayMs);
  });

  child.on("error", (err) => {
    console.error(`[${new Date().toLocaleString()}] [SUPERVISOR] Process spawn error:`, err);
  });
}

function handleShutdown(signal: string) {
  console.log(`\n[${new Date().toLocaleString()}] [SUPERVISOR] Received ${signal}. Shutting down supervisor...`);
  isShuttingDown = true;
  if (child) {
    child.kill("SIGINT");
  }
  setTimeout(() => {
    process.exit(0);
  }, 1000);
}

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));

startProcess();
