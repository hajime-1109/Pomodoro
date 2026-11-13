import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaTopScrim } from "@hatch/space-sdk/client";
import { api } from "./api";

type Mode = "work" | "break";

const DURATIONS: Record<Mode, number> = {
  work: 25 * 60,
  break: 5 * 60,
};

/**
 * The 30 quotes the user approved: all 30 from the Bible. The server
 * stores only the index of the currently shown quote (chosen at random
 * on each completed work session); the texts live here. Keep the
 * server's QUOTE_COUNT in sync with this list's length.
 */
const QUOTES: { text: string; source: string }[] = [
  // 聖書
  { text: "求めなさい。そうすれば、与えられる。", source: "マタイ7:7" },
  {
    text: "すべて疲れた人、重荷を負っている人は、わたしのところに来なさい。わたしがあなたがたを休ませてあげます。",
    source: "マタイ11:28",
  },
  {
    text: "涙とともに種を蒔く人は、喜びの歌とともに刈り入れる。",
    source: "詩編126:5",
  },
  { text: "恐れるな。わたしはあなたと共にいる。", source: "イザヤ41:10" },
  { text: "すべてには時がある。", source: "コヘレト3:1" },
  {
    text: "希望をもって喜び、苦難を耐え忍び、たゆまず祈りなさい。",
    source: "ローマ12:12",
  },
  { text: "愛は忍耐強い。愛は情け深い。", source: "コリント一13:4" },
  {
    text: "主はわたしの羊飼い。わたしには何も欠けることがない。",
    source: "詩編23:1",
  },
  {
    text: "心を尽くして主に信頼し、自分の聡明さに頼ってはならない。",
    source: "箴言3:5",
  },
  {
    text: "善を行うことに、うみ疲れてはならない。時が来れば、刈り取ることになる。",
    source: "ガラテヤ6:9",
  },
  // 聖書(続き)
  {
    text: "わたしを強くしてくださる方によって、わたしはどんなことでもできる。",
    source: "フィリピ4:13",
  },
  {
    text: "神はわたしたちの避け所、力。苦難のとき、必ずそこにいまし助けてくださる。",
    source: "詩編46:2",
  },
  {
    text: "わたしは、あなたがたに平和を残す。わたしの平和を与える。",
    source: "ヨハネ14:27",
  },
  {
    text: "主を待ち望む者は新たな力を得、鷲のように翼を広げて上る。",
    source: "イザヤ40:31",
  },
  {
    text: "あなたの業を主にゆだねよ。そうすれば、あなたの計画は確かになる。",
    source: "箴言16:3",
  },
  {
    text: "明日のことまで思い悩むな。明日のことは明日自らが思い悩む。その日の苦労は、その日だけで十分である。",
    source: "マタイ6:34",
  },
  {
    text: "あなたの御言葉は、わたしの歩みを照らす灯、わたしの道の光です。",
    source: "詩編119:105",
  },
  {
    text: "信仰とは、望んでいる事柄を確信し、見えない事実を確認することです。",
    source: "ヘブライ11:1",
  },
  {
    text: "知恵に欠けている人がいれば、神に願いなさい。神は、惜しみなく、とがめだてすることなくお与えになる。",
    source: "ヤコブ1:5",
  },
  {
    text: "思い煩いは、すべて神にお任せしなさい。神が、あなたがたのことを心にかけていてくださるからです。",
    source: "ペトロ一5:7",
  },
  {
    text: "あなたの道を主にゆだねよ。主に信頼せよ。主が成し遂げてくださる。",
    source: "詩編37:5",
  },
  {
    text: "神を愛する者たちには、万事が益となるように共に働く。",
    source: "ローマ8:28",
  },
  {
    text: "何事でも思い煩うな。祈りと願いをもって、感謝を込めて、あなたがたの願いを神に申し上げなさい。",
    source: "フィリピ4:6",
  },
  {
    text: "わたしの恵みはあなたに十分である。力は弱さの中でこそ十分に発揮されるのだ。",
    source: "コリント二12:9",
  },
  {
    text: "あなたがたには世で苦難がある。しかし、勇気を出しなさい。わたしは既に世に勝っている。",
    source: "ヨハネ16:33",
  },
  {
    text: "主はわたしの光、わたしの救い。わたしは誰を恐れよう。",
    source: "詩編27:1",
  },
  {
    text: "水の中を通るときも、わたしはあなたと共にいる。",
    source: "イザヤ43:2",
  },
  {
    text: "強く、雄々しくあれ。恐れてはならない。主なるあなたの神が、あなたと共に歩まれる。",
    source: "申命記31:6",
  },
  {
    text: "これは主が造られた日。喜び祝い、喜び踊ろう。",
    source: "詩編118:24",
  },
  {
    text: "わたしは、あなたたちのために立てた計画をよく心に留めている。それは平和の計画であって、災いの計画ではない。将来と希望を与えるものである。",
    source: "エレミヤ29:11",
  },
];

/**
 * Drinks that can fill the clock. One is picked at random for each
 * session (work or break), so every run fills the glass with something
 * different. `deep` is the colour at the bottom of the glass, `light`
 * the colour at the surface.
 */
type Drink = {
  name: string;
  deep: string;
  light: string;
  foam?: boolean;
  bubbles?: boolean;
};

const DRINKS: Drink[] = [
  { name: "オレンジジュース", deep: "#ea580c", light: "#fb923c" },
  { name: "コーラ", deep: "#170b05", light: "#4a2513", bubbles: true },
  { name: "ビール", deep: "#d97706", light: "#fbbf24", foam: true, bubbles: true },
  { name: "レモネード", deep: "#eab308", light: "#fde68a" },
  { name: "水", deep: "#0284c7", light: "#7dd3fc" },
  { name: "メロンソーダ", deep: "#16a34a", light: "#86efac", bubbles: true },
  { name: "ぶどうジュース", deep: "#7e22ce", light: "#c084fc" },
  { name: "いちごミルク", deep: "#ec4899", light: "#f9a8d4" },
];

function randomDrink(exclude?: Drink): Drink {
  let next = DRINKS[Math.floor(Math.random() * DRINKS.length)] ?? DRINKS[0]!;
  while (DRINKS.length > 1 && next === exclude) {
    next = DRINKS[Math.floor(Math.random() * DRINKS.length)] ?? DRINKS[0]!;
  }
  return next;
}

/** Fixed bubble spots inside the liquid (percentages of the glass). */
const BUBBLES = [
  { left: "22%", size: 7, delay: "0s", duration: "2.6s" },
  { left: "38%", size: 5, delay: "0.7s", duration: "3.1s" },
  { left: "55%", size: 8, delay: "0.3s", duration: "2.4s" },
  { left: "68%", size: 5, delay: "1.1s", duration: "3.4s" },
  { left: "80%", size: 6, delay: "0.5s", duration: "2.9s" },
];

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Vibration instead of a chime: two short pulses. The Vibration API is
 * not available everywhere (e.g. iOS Safari), so on unsupported devices
 * this simply does nothing and the on-screen mode switch is the signal.
 */
function vibrate() {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([200, 100, 200, 100, 400]);
    }
  } catch {
    // Vibration is a nicety; never let it break the timer.
  }
}

/** How the end of a session is announced: the gentle bell or vibration. */
type NotifyMode = "chime" | "vibe";

let audioCtx: AudioContext | null = null;

/**
 * Returns the shared AudioContext, creating and resuming it as needed.
 * Browsers only allow audio after a user gesture, so this is also
 * called from button presses to unlock sound before the timer ends.
 */
function ensureAudioContext(): AudioContext | null {
  try {
    if (typeof window === "undefined") return null;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    if (!audioCtx) audioCtx = new Ctor();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * The one fixed chime: a single soft bell ("チーン"). Synthesised with
 * the Web Audio API — a fundamental plus two quiet partials, each
 * decaying exponentially — so no audio file is needed. The peak volume
 * is deliberately low so it stays easy on the ears.
 */
function playBell() {
  const ctx = ensureAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.14, now + 0.012);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 2.8);
    master.connect(ctx.destination);
    const partials = [
      { freq: 1567.98, gain: 1 },
      { freq: 3135.96, gain: 0.32 },
      { freq: 4308.6, gain: 0.1 },
    ];
    for (const p of partials) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(p.freq, now);
      const g = ctx.createGain();
      g.gain.setValueAtTime(p.gain, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);
      osc.connect(g);
      g.connect(master);
      osc.start(now);
      osc.stop(now + 2.9);
    }
  } catch {
    // Sound is a nicety; never let it break the timer.
  }
}

export function App() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>("work");
  const [secondsLeft, setSecondsLeft] = useState(DURATIONS.work);
  const [running, setRunning] = useState(false);
  // The drink filling the clock this session; a new one is drawn at
  // random every time a session starts (mode switch, manual or auto).
  const [drink, setDrink] = useState<Drink>(() => randomDrink());
  // End-of-session notification: gentle bell or vibration only. The
  // choice is kept in this browser so it is where the user left it.
  const [notifyMode, setNotifyMode] = useState<NotifyMode>(() => {
    try {
      return window.localStorage.getItem("pomodoro-notify-mode") === "vibe"
        ? "vibe"
        : "chime";
    } catch {
      return "chime";
    }
  });
  const endAtRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem("pomodoro-notify-mode", notifyMode);
    } catch {
      // Storage may be unavailable; the switch still works this visit.
    }
  }, [notifyMode]);

  const selectNotify = (next: NotifyMode) => {
    setNotifyMode(next);
    // A soft preview on switching to the bell, so the user hears the
    // sound they picked (and the gesture unlocks audio for later).
    if (next === "chime") playBell();
  };

  const stats = useQuery({
    queryKey: ["stats"],
    queryFn: () => api.getStats({}),
  });
  const completedCount = stats.data?.completedCount ?? 0;
  const todayCount = stats.data?.todayCount ?? 0;
  const quoteIndex = stats.data?.quoteIndex ?? null;
  const quote =
    quoteIndex != null && quoteIndex >= 0 && quoteIndex < QUOTES.length
      ? QUOTES[quoteIndex]
      : undefined;

  const completeWork = useMutation({
    mutationFn: async () => await api.completeWorkSession({}),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["stats"] }),
  });

  const switchMode = useCallback((next: Mode) => {
    setMode(next);
    setSecondsLeft(DURATIONS[next]);
    setRunning(false);
    endAtRef.current = null;
    setDrink((prev) => randomDrink(prev));
  }, []);

  const finishSession = useCallback(() => {
    if (notifyMode === "chime") {
      playBell();
    } else {
      vibrate();
    }
    if (mode === "work") {
      completeWork.mutate();
      switchMode("break");
    } else {
      switchMode("work");
    }
  }, [mode, completeWork, switchMode, notifyMode]);

  // Timestamp-based countdown: interval only re-reads the wall clock,
  // so a backgrounded tab does not drift.
  useEffect(() => {
    if (!running) return;
    if (endAtRef.current == null) {
      endAtRef.current = Date.now() + secondsLeft * 1000;
    }
    const tick = () => {
      const end = endAtRef.current;
      if (end == null) return;
      const remaining = Math.max(0, Math.round((end - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        endAtRef.current = null;
        finishSession();
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
    // secondsLeft intentionally omitted: the deadline ref is the source
    // of truth while running; re-running on every tick would reset it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, finishSession]);

  const toggleRun = () => {
    if (running) {
      // Freeze the remaining time so resume continues from here.
      if (endAtRef.current != null) {
        setSecondsLeft(
          Math.max(0, Math.round((endAtRef.current - Date.now()) / 1000)),
        );
        endAtRef.current = null;
      }
      setRunning(false);
    } else {
      if (secondsLeft <= 0) setSecondsLeft(DURATIONS[mode]);
      // Unlock audio on this user gesture so the bell can play when
      // the session ends, even if the tab sat idle until then.
      if (notifyMode === "chime") ensureAudioContext();
      endAtRef.current = null;
      setRunning(true);
    }
  };

  const total = DURATIONS[mode];
  const progress = total > 0 ? 1 - secondsLeft / total : 0;
  // Progress ring geometry.
  const R = 120;
  const C = 2 * Math.PI * R;

  const tabClass = (active: boolean) =>
    `flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-full text-lg font-bold transition-colors ${
      active ? "neu-raised-sm text-[var(--text)]" : "text-[var(--dim)]"
    }`;

  return (
    <div
      className="min-h-screen bg-[var(--bg)] text-[var(--text)]"
      style={{ fontFamily: "var(--font-round)" }}
    >
      <SafeAreaTopScrim backgroundColor="var(--bg)" />

      <main className="mx-auto flex w-full max-w-md flex-col items-center px-6 pb-10 pt-8">
        {/* 作業 / 休憩 */}
        <div
          className="neu-inset flex w-full gap-2 rounded-full p-2"
          role="tablist"
          aria-label="モード"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "work"}
            aria-label="作業モード（25分）"
            className={tabClass(mode === "work")}
            onClick={() => switchMode("work")}
          >
            作業
            <span className="text-sm font-medium opacity-80">25分</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "break"}
            aria-label="休憩モード（5分）"
            className={tabClass(mode === "break")}
            onClick={() => switchMode("break")}
          >
            休憩
            <span className="text-sm font-medium opacity-80">5分</span>
          </button>
        </div>

        {/* 時計 + 通知スイッチ */}
        <div className="mt-12 flex items-center justify-center gap-3 sm:gap-4">
        <div className="neu-raised relative flex aspect-square w-[min(272px,63vw)] items-center justify-center rounded-full">
          <svg
            className="absolute inset-0 h-full w-full -rotate-90"
            viewBox="0 0 280 280"
            aria-hidden="true"
          >
            <circle
              cx="140"
              cy="140"
              r={R}
              fill="none"
              stroke="var(--border)"
              strokeWidth="10"
            />
            <circle
              cx="140"
              cy="140"
              r={R}
              fill="none"
              stroke={drink.deep}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - progress)}
              style={{
                transition:
                  "stroke-dashoffset 0.3s linear, stroke 0.3s linear",
              }}
            />
          </svg>
          <div className="neu-inset relative flex aspect-square w-[71%] flex-col items-center justify-center overflow-hidden rounded-full">
            {/* 液体:セッションの進み具合に合わせて下から溜まる */}
            {progress > 0 && (
              <div
                className="absolute inset-x-0 bottom-0"
                style={{
                  height: `${progress * 100}%`,
                  transition: "height 0.6s linear",
                }}
                aria-hidden="true"
              >
                {/* ゆらゆら波打つ液面 */}
                <svg
                  className="liquid-wave absolute -top-[8px] left-0 h-[12px] w-[200%]"
                  viewBox="0 0 1200 60"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M0,30 C150,58 350,2 600,30 C850,58 1050,2 1200,30 L1200,60 L0,60 Z"
                    fill={drink.light}
                  />
                </svg>
                <div
                  className="absolute inset-0 top-[4px]"
                  style={{
                    background: `linear-gradient(to top, ${drink.deep}, ${drink.light})`,
                  }}
                />
                {/* ビールの泡 */}
                {drink.foam && (
                  <div className="absolute inset-x-0 top-[2px] h-[16px] bg-white/85 blur-[3px]" />
                )}
                {/* 炭酸の泡 */}
                {drink.bubbles &&
                  BUBBLES.map((b, i) => (
                    <span
                      key={i}
                      className="liquid-bubble absolute bottom-[6px] rounded-full bg-white/60"
                      style={{
                        left: b.left,
                        width: b.size,
                        height: b.size,
                        animationDelay: b.delay,
                        animationDuration: b.duration,
                      }}
                    />
                  ))}
              </div>
            )}
            {/* 内側の影を液体の上にも残す */}
            <div
              className="pointer-events-none absolute inset-0 z-20 rounded-full"
              style={{
                boxShadow:
                  "inset 6px 6px 12px var(--shadow-dark), inset -6px -6px 12px var(--shadow-light)",
              }}
              aria-hidden="true"
            />
            {/* タイマー数字だけを丸の中心に置く */}
            <div className="relative z-10 flex items-center justify-center">
              <p
                className="text-[54px] font-extrabold leading-none tabular-nums tracking-wide"
                role="timer"
                aria-label={`残り時間 ${formatTime(secondsLeft)}`}
                style={
                  progress > 0.5
                    ? { color: "#fff", textShadow: "0 2px 10px rgba(0,0,0,0.35)" }
                    : undefined
                }
              >
                {formatTime(secondsLeft)}
              </p>
            </div>
          </div>
        </div>

        {/* 縦型スイッチ:チャイム / バイブ */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="neu-inset relative flex h-[176px] w-[64px] flex-col rounded-full p-2"
            role="group"
            aria-label="終了時の通知方法"
          >
            {/* スライドするつまみ:選ばれている方へ移動する */}
            <div
              className="notify-knob pointer-events-none absolute left-2 top-2 h-[76px] w-[48px] rounded-full"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                boxShadow:
                  "4px 4px 10px var(--shadow-dark), -4px -4px 10px var(--shadow-light)",
                transform:
                  notifyMode === "chime"
                    ? "translateY(0)"
                    : "translateY(84px)",
                transition: "transform 0.3s ease",
              }}
              aria-hidden="true"
            />
            <button
              type="button"
              aria-pressed={notifyMode === "chime"}
              aria-label="チャイム（優しいベルの音）で知らせる"
              className="relative z-10 flex h-[76px] w-full flex-col items-center justify-center gap-1 rounded-full"
              style={{
                color: notifyMode === "chime" ? "var(--text)" : "var(--dim)",
              }}
              onClick={() => selectNotify("chime")}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
              <span className="text-[11px] font-bold leading-none">
                チャイム
              </span>
            </button>
            <button
              type="button"
              aria-pressed={notifyMode === "vibe"}
              aria-label="バイブ（振動のみ）で知らせる"
              className="relative z-10 flex h-[76px] w-full flex-col items-center justify-center gap-1 rounded-full"
              style={{
                color: notifyMode === "vibe" ? "var(--text)" : "var(--dim)",
              }}
              onClick={() => selectNotify("vibe")}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="9" y="3" width="6" height="18" rx="2" />
                <path d="M5 8v8" />
                <path d="M19 8v8" />
              </svg>
              <span className="text-[11px] font-bold leading-none">
                バイブ
              </span>
            </button>
          </div>
        </div>
        </div>

        {/* 操作ボタン */}
        <div className="mt-10 flex items-center justify-center">
          <button
            type="button"
            aria-label={running ? "一時停止" : "スタート"}
            className="neu-btn flex h-[76px] min-w-[168px] items-center justify-center rounded-full px-8 text-xl font-extrabold text-[var(--text)]"
            style={{ background: "var(--surface)" }}
            onClick={toggleRun}
          >
            {running ? "❚❚ 一時停止" : "▶ スタート"}
          </button>
        </div>

        {/* 回数 */}
        <div className="neu-raised mt-12 w-full rounded-[var(--radius)] px-6 py-6 text-center">
          <p className="text-sm font-bold tracking-widest text-[var(--dim)]">
            作業した回数
          </p>
          <div className="mt-2 flex items-baseline justify-center gap-3">
            <p className="text-5xl font-extrabold tabular-nums">
              {stats.isPending ? "…" : completedCount}
              <span className="ml-2 text-xl font-bold text-[var(--dim)]">
                回
              </span>
            </p>
            <p className="text-base font-bold tabular-nums text-[var(--dim)]">
              今日 {stats.isPending ? "…" : todayCount} 回
            </p>
          </div>
          {stats.isError && (
            <p className="mt-2 text-sm text-[var(--accent)]">
              回数を読み込めませんでした
            </p>
          )}

          {/* 名言:作業が1回終わるたびにランダムで1つ表示される */}
          {quote && (
            <figure className="neu-inset mt-6 rounded-[20px] px-5 py-5">
              <blockquote className="text-base font-bold leading-relaxed">
                {quote.text}
              </blockquote>
              <figcaption className="mt-2 text-sm text-[var(--dim)]">
                — {quote.source}
              </figcaption>
            </figure>
          )}
        </div>
      </main>
    </div>
  );
}
