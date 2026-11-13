// Vercel Function for the Pomodoro standalone.
// The Vite client POSTs to /actions; vercel.json rewrites that to
// /api/actions. Data lives in a Turso (libSQL) database configured with
// TURSO_DATABASE_URL / TURSO_AUTH_TOKEN. For local testing the URL may
// be a file: URL, in which case no token is needed.

import { createClient } from "@libsql/client";

const QUOTE_COUNT = 30;

let client = null;
let initPromise = null;

function getClient() {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) return null;
  if (!client) {
    client = createClient({
      url,
      authToken: process.env.TURSO_AUTH_TOKEN || undefined,
    });
  }
  if (!initPromise) {
    initPromise = client.execute(`
      CREATE TABLE IF NOT EXISTS stats (
        id INTEGER PRIMARY KEY,
        completed_count INTEGER NOT NULL DEFAULT 0,
        quote_index INTEGER,
        today_count INTEGER NOT NULL DEFAULT 0,
        today_date TEXT
      )
    `);
  }
  return client;
}

function todayInJST() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

async function readRow(db) {
  const result = await db.execute(
    `SELECT
       completed_count AS completedCount,
       quote_index AS quoteIndex,
       today_count AS todayCount,
       today_date AS todayDate
     FROM stats
     WHERE id = 1`,
  );
  return result.rows[0] ?? null;
}

function toStats(row) {
  return {
    completedCount: row ? Number(row.completedCount) : 0,
    todayCount:
      row && row.todayDate === todayInJST() ? Number(row.todayCount) : 0,
    quoteIndex: row?.quoteIndex ?? null,
  };
}

async function getStats(db) {
  return toStats(await readRow(db));
}

async function completeWorkSession(db) {
  const tx = await db.transaction("write");
  try {
    const row = await readRow(tx);
    const completedCount = (row ? Number(row.completedCount) : 0) + 1;
    const today = todayInJST();
    const todayCount =
      row && row.todayDate === today ? Number(row.todayCount) + 1 : 1;

    const previousQuote = row?.quoteIndex ?? null;
    let quoteIndex = Math.floor(Math.random() * QUOTE_COUNT);
    if (previousQuote != null && quoteIndex === Number(previousQuote)) {
      quoteIndex = (quoteIndex + 1) % QUOTE_COUNT;
    }

    if (row) {
      await tx.execute({
        sql: `UPDATE stats
              SET completed_count = ?, today_count = ?, today_date = ?, quote_index = ?
              WHERE id = 1`,
        args: [completedCount, todayCount, today, quoteIndex],
      });
    } else {
      await tx.execute({
        sql: `INSERT INTO stats
                (id, completed_count, today_count, today_date, quote_index)
              VALUES (1, ?, ?, ?, ?)`,
        args: [completedCount, todayCount, today, quoteIndex],
      });
    }

    await tx.commit();
    return { completedCount, todayCount, quoteIndex };
  } catch (error) {
    await tx.rollback().catch(() => {});
    throw error;
  } finally {
    tx.close();
  }
}

async function resetStats(db) {
  const today = todayInJST();
  const row = await readRow(db);
  if (row) {
    await db.execute({
      sql: `UPDATE stats
            SET completed_count = 0, today_count = 0, today_date = ?, quote_index = NULL
            WHERE id = 1`,
      args: [today],
    });
  } else {
    await db.execute({
      sql: `INSERT INTO stats
              (id, completed_count, today_count, today_date, quote_index)
            VALUES (1, 0, 0, ?, NULL)`,
      args: [today],
    });
  }
  return { completedCount: 0, todayCount: 0, quoteIndex: null };
}

const actions = {
  getStats,
  completeWorkSession,
  resetStats,
};

function sendJson(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
}

async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === "string") return JSON.parse(req.body || "{}");
    if (typeof req.body === "object") return req.body;
  }
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  const db = getClient();
  if (!db) {
    sendJson(res, 503, {
      error:
        "Database is not configured. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.",
    });
    return;
  }

  try {
    await initPromise;
    const body = await readBody(req);
    const actionName = body?.action;
    if (
      typeof actionName !== "string" ||
      !Object.hasOwn(actions, actionName)
    ) {
      sendJson(res, 404, { error: `Unknown action: ${actionName}` });
      return;
    }
    sendJson(res, 200, await actions[actionName](db));
  } catch (error) {
    sendJson(res, 500, {
      error: error instanceof Error ? error.message : "Internal error",
    });
  }
}
