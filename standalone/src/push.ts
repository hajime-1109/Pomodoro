// Server-scheduled push reminders for the standalone (option 4).
//
// The in-page timer cannot ring while the app is backgrounded or
// closed: its finish check only runs while the page is alive. So when
// a session starts, this module asks the server to store a reminder
// and have QStash call back at the end time; the server then sends a
// Web Push and the service worker shows the notification. Pausing,
// finishing, or switching modes cancels the pending reminder.
//
// Everything here is best-effort: any failure (no permission, no push
// support, offline) is swallowed and the in-app chime/vibration path
// keeps working exactly as before.

// VAPID public key. The matching private key lives only in the
// server's environment (VAPID_PRIVATE_KEY).
const VAPID_PUBLIC_KEY =
  "BHk_d4F7IGnMapxjCT6RQzRDOwWjdAQbdUAkPUyFFy3VqViww01qse2dswFmQ1F6GVhcPcSjYf3g0jngeNC7xAU";

const ENDPOINT_STORAGE_KEY = "pomodoro-push-endpoint";
const NOTIFY_MODE_STORAGE_KEY = "pomodoro-notify-mode";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

async function postAction(
  action: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const response = await fetch("/actions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, args }),
  });
  if (!response.ok) throw new Error(`Action ${action} failed`);
  return response.json().catch(() => null);
}

async function ensureSubscription(): Promise<string | null> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return null;
  }
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    if (!("Notification" in window)) return null;
    if (Notification.permission === "default") {
      // Called from the timer-start event, which is dispatched inside
      // the start button's click handler, so the permission prompt is
      // allowed to appear here.
      await Notification.requestPermission();
    }
    if (Notification.permission !== "granted") return null;
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const endpoint = subscription.endpoint;
  let savedEndpoint: string | null = null;
  try {
    savedEndpoint = window.localStorage.getItem(ENDPOINT_STORAGE_KEY);
  } catch {
    savedEndpoint = null;
  }
  if (savedEndpoint !== endpoint) {
    await postAction("savePushSubscription", {
      subscription: subscription.toJSON(),
    });
    try {
      window.localStorage.setItem(ENDPOINT_STORAGE_KEY, endpoint);
    } catch {
      // Storage may be unavailable; the subscription is saved anyway.
    }
  }
  return endpoint;
}

function storedEndpoint(): string | null {
  try {
    return window.localStorage.getItem(ENDPOINT_STORAGE_KEY);
  } catch {
    return null;
  }
}

function isSilentMode(): boolean {
  try {
    return window.localStorage.getItem(NOTIFY_MODE_STORAGE_KEY) === "vibe";
  } catch {
    return false;
  }
}

async function handleTimerStart(event: Event) {
  const detail = (event as CustomEvent).detail as
    | { mode?: string; endsAt?: number }
    | undefined;
  const endsAt = detail?.endsAt;
  if (typeof endsAt !== "number") return;
  const endpoint = await ensureSubscription();
  if (!endpoint) return;
  const result = (await postAction("scheduleReminder", {
    endpoint,
    fireAt: endsAt,
    mode: detail?.mode === "break" ? "break" : "work",
    silent: isSilentMode(),
  })) as { scheduled?: boolean } | null;
  if (result && result.scheduled === false) {
    // The reminder row is stored but nothing will fire it (QStash /
    // push env vars not configured on the server). Until 2026-11-20
    // this was silently ignored, so background alerts failed with no
    // trace anywhere. Keep it console-only: no UI change.
    console.warn(
      "[pomodoro-push] Reminder stored but NOT scheduled " +
        "(server push is not configured); background alert will not fire.",
    );
  }
}

async function handleTimerStop() {
  const endpoint = storedEndpoint();
  if (!endpoint) return;
  await postAction("cancelReminder", { endpoint });
}

let initialized = false;

export function initPush() {
  if (initialized) return;
  initialized = true;
  window.addEventListener("pomodoro:timer-start", (event) => {
    void handleTimerStart(event).catch((error) => {
      console.warn("[pomodoro-push] Failed to schedule reminder:", error);
    });
  });
  window.addEventListener("pomodoro:timer-stop", () => {
    void handleTimerStop().catch((error) => {
      console.warn("[pomodoro-push] Failed to cancel reminder:", error);
    });
  });
}
