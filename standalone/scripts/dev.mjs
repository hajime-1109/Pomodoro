import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const standaloneDir = path.resolve(here, "..");
const viteBin = path.join(
  standaloneDir,
  "node_modules",
  "vite",
  "bin",
  "vite.js",
);

const children = [
  spawn(process.execPath, [path.join(standaloneDir, "server.mjs")], {
    cwd: standaloneDir,
    stdio: "inherit",
  }),
  spawn(
    process.execPath,
    [viteBin, "--host", "127.0.0.1", "--port", "5173"],
    {
      cwd: standaloneDir,
      stdio: "inherit",
    },
  ),
];

let stopping = false;

function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  setTimeout(() => process.exit(exitCode), 100).unref();
}

for (const child of children) {
  child.on("error", (error) => {
    console.error(error);
    stop(1);
  });
  child.on("exit", (code) => {
    if (!stopping && code !== 0) stop(code ?? 1);
  });
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
