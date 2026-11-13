// Minimal service worker for the Pomodoro standalone.
// - Precache the app shell ("/") so the app opens offline.
// - Runtime-cache same-origin static assets (stale-while-revalidate).
// - Never touch /actions: counts must always hit the network, and any
//   non-GET request is passed through untouched.

const CACHE = "pomodoro-v1";
const SHELL = ["/", "/manifest.webmanifest", "/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Server-scheduled push (option 4): the push arrives via QStash ->
// /api/push-fire -> the browser's push service. Showing the
// notification is the service worker's job — this is the only alert
// that can fire while the app is closed.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const isBreak = data.mode === "break";
  const title = isBreak ? "休憩終了" : "作業終了";
  const body = isBreak
    ? "休憩おわり。次の25分を始めよう。"
    : "25分お疲れさま。休憩に入ってね。";
  const options = {
    body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: "pomodoro-timer",
    renotify: true,
    timestamp: Date.now(),
    data: { url: "/" },
  };
  if (data.silent) {
    // Vibe mode: no sound. Vibration is best-effort — the platform may
    // still suppress it for silent notifications.
    options.silent = true;
    options.vibrate = [200, 100, 200, 100, 400];
  }
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windows) => {
        for (const client of windows) {
          if ("focus" in client) return client.focus();
        }
        return self.clients.openWindow(target);
      }),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === "/actions" || url.pathname.startsWith("/api/")) {
    return;
  }

  // Navigations: network first, fall back to the cached shell offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches
            .open(CACHE)
            .then((cache) => cache.put("/", copy))
            .catch(() => {});
          return response;
        })
        .catch(() => caches.match("/")),
    );
    return;
  }

  // Static assets: stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches
              .open(CACHE)
              .then((cache) => cache.put(request, copy))
              .catch(() => {});
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
