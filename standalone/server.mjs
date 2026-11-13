import fs from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(here, "dist");
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 8787);
const dbPath = process.env.POMODORO_DB_PATH
  ? path.resolve(process.env.POMODORO_DB_PATH)
  : path.join(here, "data", "pomodoro.db");

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec(`
  CREATE TABLE IF NOT EXISTS stats (
    id INTEGER PRIMARY KEY,
    completed_count INTEGER NOT NULL DEFAULT 0,
    quote_index INTEGER,
    today_count INTEGER NOT NULL DEFAULT 0,
    today_date TEXT
  )
`);

const QUOTE_COUNT = 30;

function todayInJST() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

function getRow() {
  return db
    .prepare(
      `SELECT
         completed_count AS completedCount,
         quote_index AS quoteIndex,
         today_count AS todayCount,
         today_date AS todayDate
       FROM stats
       WHERE id = 1`,
    )
    .get();
}

function getStats() {
  const row = getRow();
  return {
    completedCount: row?.completedCount ?? 0,
    todayCount:
      row && row.todayDate === todayInJST() ? row.todayCount : 0,
    quoteIndex: row?.quoteIndex ?? null,
  };
}

function completeWorkSession() {
  const row = getRow();
  const completedCount = (row?.completedCount ?? 0) + 1;
  const today = todayInJST();
  const todayCount =
    row && row.todayDate === today ? row.todayCount + 1 : 1;

  const previousQuote = row?.quoteIndex ?? null;
  let quoteIndex = Math.floor(Math.random() * QUOTE_COUNT);
  if (previousQuote != null && quoteIndex === previousQuote) {
    quoteIndex = (quoteIndex + 1) % QUOTE_COUNT;
  }

  if (row) {
    db.prepare(
      `UPDATE stats
       SET completed_count = ?, today_count = ?, today_date = ?, quote_index = ?
       WHERE id = 1`,
    ).run(completedCount, todayCount, today, quoteIndex);
  } else {
    db.prepare(
      `INSERT INTO stats
         (id, completed_count, today_count, today_date, quote_index)
       VALUES (1, ?, ?, ?, ?)`,
    ).run(completedCount, todayCount, today, quoteIndex);
  }

  return { completedCount, todayCount, quoteIndex };
}

function resetStats() {
  const row = getRow();
  const today = todayInJST();
  if (row) {
    db.prepare(
      `UPDATE stats
       SET completed_count = 0, today_count = 0, today_date = ?, quote_index = NULL
       WHERE id = 1`,
    ).run(today);
  } else {
    db.prepare(
      `INSERT INTO stats
         (id, completed_count, today_count, today_date, quote_index)
       VALUES (1, 0, 0, ?, NULL)`,
    ).run(today);
  }
  return { completedCount: 0, todayCount: 0, quoteIndex: null };
}

const actions = {
  getStats,
  completeWorkSession,
  resetStats,
};

function sendJson(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
  });
  response.end(body);
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > 1_000_000) {
        reject(new Error("Request body is too large"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    request.on("error", reject);
  });
}

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function serveStatic(request, response, pathname) {
  const indexFile = path.join(distDir, "index.html");
  if (!fs.existsSync(indexFile)) {
    response.writeHead(503, { "content-type": "text/plain; charset=utf-8" });
    response.end("Run `npm run build` first.\n");
    return;
  }

  let requestedPath;
  try {
    requestedPath = decodeURIComponent(pathname);
  } catch {
    response.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
    response.end("Bad request\n");
    return;
  }

  const relativePath =
    requestedPath === "/" ? "index.html" : requestedPath.replace(/^\/+/, "");
  let filePath = path.resolve(distDir, relativePath);

  if (!filePath.startsWith(`${distDir}${path.sep}`) && filePath !== distDir) {
    response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
    response.end("Forbidden\n");
    return;
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    if (path.extname(requestedPath)) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found\n");
      return;
    }
    filePath = indexFile;
  }

  const type =
    mimeTypes[path.extname(filePath).toLowerCase()] ||
    "application/octet-stream";
  response.writeHead(200, { "content-type": type });
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  fs.createReadStream(filePath).pipe(response);
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host}`);

  if (url.pathname === "/actions") {
    if (request.method !== "POST") {
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }

    try {
      const body = await readJsonBody(request);
      const actionName =
        body && typeof body === "object" ? body.action : undefined;
      if (
        typeof actionName !== "string" ||
        !Object.hasOwn(actions, actionName)
      ) {
        sendJson(response, 404, { error: `Unknown action: ${actionName}` });
        return;
      }
      sendJson(response, 200, actions[actionName]());
    } catch (error) {
      sendJson(response, 400, {
        error: error instanceof Error ? error.message : "Bad request",
      });
    }
    return;
  }

  if (request.method === "GET" || request.method === "HEAD") {
    serveStatic(request, response, url.pathname);
    return;
  }

  sendJson(response, 405, { error: "Method not allowed" });
});

server.listen(port, host, () => {
  console.log(`Pomodoro standalone: http://${host}:${port}`);
  console.log(`SQLite database: ${dbPath}`);
});
