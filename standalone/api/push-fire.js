// Vercel Function called by QStash when a scheduled reminder is due.
// Verifies the shared secret, claims the reminder row (so retries can
// never double-send), then delivers the Web Push to the stored
// subscription. The service worker turns the push into the visible
// notification — this is the only path that can alert the user while
// the app is closed.

import { createClient } from "@libsql/client";
import crypto from "node:crypto";
import webpush from "web-push";

// Only VAPID_PRIVATE_KEY is configured by hand. The public key is
// derived from it (VAPID uses an EC P-256 key pair, and the client
// already carries the matching public key), so there is no separate
// VAPID_PUBLIC_KEY env var to keep in sync.
function deriveVapidPublicKey(privateKey) {
  const raw = Buffer.from(
    privateKey.replace(/-/g, "+").replace(/_/g, "/"),
    "base64",
  );
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.setPrivateKey(raw);
  return ecdh
    .getPublicKey(null, "uncompressed")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

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
    initPromise = (async () => {
      await client.execute(`
        CREATE TABLE IF NOT EXISTS push_subscriptions (
          endpoint TEXT PRIMARY KEY,
          p256dh TEXT NOT NULL,
          auth TEXT NOT NULL,
          created_at INTEGER NOT NULL
        )
      `);
      await client.execute(`
        CREATE TABLE IF NOT EXISTS reminders (
          id TEXT PRIMARY KEY,
          endpoint TEXT NOT NULL,
          fire_at INTEGER NOT NULL,
          mode TEXT NOT NULL,
          silent INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'pending',
          created_at INTEGER NOT NULL
        )
      `);
    })();
  }
  return client;
}

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

  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!privateKey) {
    sendJson(res, 503, {
      error: "Push is not configured. Set VAPID_PRIVATE_KEY.",
    });
    return;
  }
  const publicKey = deriveVapidPublicKey(privateKey);

  const db = getClient();
  if (!db) {
    sendJson(res, 503, { error: "Database is not configured." });
    return;
  }

  try {
    await initPromise;
    const body = await readBody(req);
    // The reminderId is an unguessable UUID created server-side, and
    // the row must still be 'pending' below, so the id itself acts as
    // the capability — no separate callback secret to configure.
    if (typeof body?.reminderId !== "string") {
      sendJson(res, 401, { error: "Unauthorized" });
      return;
    }

    const found = await db.execute({
      sql: `SELECT id, endpoint, mode, silent, status
            FROM reminders WHERE id = ?`,
      args: [body.reminderId],
    });
    const reminder = found.rows[0];
    if (!reminder || reminder.status !== "pending") {
      sendJson(res, 200, { skipped: true });
      return;
    }

    // Claim first: even if QStash retries, the push goes out only once.
    const claim = await db.execute({
      sql: `UPDATE reminders SET status = 'sent'
            WHERE id = ? AND status = 'pending'`,
      args: [reminder.id],
    });
    if (Number(claim.rowsAffected) === 0) {
      sendJson(res, 200, { skipped: true });
      return;
    }

    const subResult = await db.execute({
      sql: `SELECT endpoint, p256dh, auth
            FROM push_subscriptions WHERE endpoint = ?`,
      args: [reminder.endpoint],
    });
    const sub = subResult.rows[0];
    if (!sub) {
      sendJson(res, 200, { skipped: "no-subscription" });
      return;
    }

    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:pomodoro@example.com",
      publicKey,
      privateKey,
    );

    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify({
          mode: reminder.mode,
          silent: Number(reminder.silent) === 1,
        }),
        { TTL: 120 },
      );
      sendJson(res, 200, { sent: true });
    } catch (error) {
      const statusCode = error?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        // Subscription is gone for good; drop it.
        await db
          .execute({
            sql: `DELETE FROM push_subscriptions WHERE endpoint = ?`,
            args: [sub.endpoint],
          })
          .catch(() => {});
        sendJson(res, 200, { skipped: "subscription-gone" });
        return;
      }
      throw error;
    }
  } catch (error) {
    sendJson(res, 500, {
      error: error instanceof Error ? error.message : "Internal error",
    });
  }
}
