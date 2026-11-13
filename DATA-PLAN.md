# Data Plan

## Context provenance
- `ニューモフィズムを基軸としたuiuxのポモドーロサイト。25分の作業と5分の休憩ができるだけ。何回作業したかの回数が表示される。` (verbatim build request; defines the entire scope: 25-min work, 5-min break, completed-work count)
- `バランスとしては、まず、作業 休憩 / 時計 / 回数 みたいな表示だよ。色は白を基調としてね。` (verbatim build request; defines layout order top-to-bottom: mode tabs, clock, count; white-based palette)

## Tested sources
No external data sources. The timer is fully client-side (timestamp-based countdown for accuracy). The only persisted state is the user's own completed-work-session count, stored in the artifact DB via server actions (getStats / completeWorkSession / resetStats) so the count survives reloads. No web search, no agent tasks, no images.

Imagery not needed: the design is pure neumorphic surfaces, shadows, and typography — no visual subjects; decorative imagery would fight the soft white aesthetic the user asked for.

## Quotes (added 2026-11-10; replaced with all-Bible list 2026-11-10)
- The 30 quote texts and attributions shown under the count are the exact list the user approved in chat, verbatim in the edit brief. Originally a mix (聖書10・偉人10・日本10); the user then replaced the whole list with 30 Bible verses only: マタイ7:7, マタイ11:28, 詩編126:5, イザヤ41:10, コヘレト3:1, ローマ12:12, コリント一13:4, 詩編23:1, 箴言3:5, ガラテヤ6:9, フィリピ4:13, 詩編46:2, ヨハネ14:27, イザヤ40:31, 箴言16:3, マタイ6:34, 詩編119:105, ヘブライ11:1, ヤコブ1:5, ペトロ一5:7, 詩編37:5, ローマ8:28, フィリピ4:6, コリント二12:9, ヨハネ16:33, 詩編27:1, イザヤ43:2, 申命記31:6, 詩編118:24, エレミヤ29:11. The texts live as a constant in `client/src/App.tsx` — no external source.
- Behavior per the user's request: each time a work session completes and the count increases, `completeWorkSession` picks a random index 0–29 (never repeating the currently shown one) and stores it in `stats.quote_index`; the client renders that quote under the count. The index persists server-side, so the quote survives reloads and stays in sync across devices, like the count. Before the first completion, no quote is shown. The list length stays 30, so the server's QUOTE_COUNT and any stored quote_index remain valid after the swap.

## Liquid in the clock (added 2026-11-10)
- Per the user's request, the clock's inner circle fills with liquid as the timer progresses (0% at start, 100% exactly when the session ends), with a gently waving surface. The drink is chosen at random per session (a new draw on every mode switch, manual or automatic); the list lives as a constant in `client/src/App.tsx` — the user's own examples (オレンジジュース, コーラ, ビール with foam, レモネード, 水) plus メロンソーダ, ぶどうジュース, いちごミルク in the same spirit. No external source; the drink is client-side presentation only and is not persisted.
- Update (2026-11-10): per the user's request, the drink's name is no longer displayed anywhere in the UI — only the liquid itself is shown, so what is filling up stays a surprise. The drink names remain only as internal labels in the `DRINKS` constant in `client/src/App.tsx`.

## Chime / vibration switch (added 2026-11-10)
- Per the user's request, a vertical switch beside the clock toggles the end-of-session notification between チャイム and バイブ. Chime side: one fixed gentle bell — a single soft "チーン" synthesised with the Web Audio API (sine fundamental at ~1568 Hz plus two quiet partials, exponential decay, low peak gain ~0.14); not random, no audio file. Vibe side: no sound, the existing vibration pattern only (short, short, long: [200, 100, 200, 100, 400]). The switch shows its state via a sliding knob in the mode accent colour, white-on-accent labels, and a caption under the switch (終了時はベルの音 / 振動のみ). Switching to チャイム plays the bell once as a preview and unlocks the AudioContext; starting the timer also unlocks it. The choice is stored in the browser's localStorage (`pomodoro-notify-mode`, default チャイム) — a per-device presentation preference, not server data, so no schema or action changes.

## Monochrome look + caption removal (2026-11-10)
- Per the user's request, the caption under the チャイム／バイブ switch (終了時はベルの音／振動のみ) was removed; the switch state is shown only by the knob position and label colours.
- Per the user's request, colour was removed from the UI for now: `--accent` / `--accent-break` in `theme.css` are now neutral grays (dark gray for work, mid gray for break), so the mode tabs, progress ring, start button, and switch knob are all white/gray neumorphism. The liquid in the clock keeps its fill/wave/foam/bubble animation, but each drink's deep/light pair in `DRINKS` is now a grayscale shade pair (drink names remain internal-only, still not displayed). All behaviour — timer, chime, vibration, count, quotes — is unchanged.

## Coloured liquid restored + white shadow-only buttons (2026-11-10)
- Per the user's request, the liquid colours are restored to the original coloured pairs (the grayscale pairs from the previous edit are reverted): オレンジジュース orange, コーラ dark brown, ビール amber (foam + bubbles kept), レモネード yellow, 水 blue, メロンソーダ green (bubbles kept), ぶどうジュース purple, いちごミルク pink. Drink names remain internal-only, still not displayed.
- Per the user's request, buttons are white only, with no colour accent, their presence shown by neumorphic shadow alone: the active 作業／休憩 tab now uses the raised neumorphic surface (`neu-raised-sm`, `--surface` background, dark text) instead of a filled accent background; the スタート／一時停止 button is `--surface` white with dark text and its existing `neu-btn` shadow; the チャイム／バイブ switch knob is `--surface` white with a soft raised shadow and thin border, and the selected label is dark text instead of white-on-accent. The progress ring and status text keep the neutral gray accent tokens (not buttons). The switch caption stays removed. All behaviour — timer, liquid wave/foam/bubbles, chime, vibration, count, quotes — is unchanged.

## Progress ring matches the liquid (2026-11-11)
- Per the user's request, the progress ring around the clock (the groove that fills as the session progresses) now uses the current session drink's `deep` colour as its stroke, so the ring and the liquid filling the clock share the same colour (オレンジジュース orange, コーラ dark brown, ビール amber, etc.). Since the drink is drawn at random per session, the ring colour changes with it. Buttons stay white with shadow only; the switch caption stays removed. All behaviour — timer, chime, vibration, count, quotes — is unchanged.

## Today's count + centred timer digits (2026-11-11)
- Per the user's request, a today count is now shown small beside the total: the count card renders the total large and "今日○回" small beside it on the same baseline. Both counts are stored server-side in the single `stats` row: new columns `today_count` (integer, default 0) and `today_date` (text, JST YYYY-MM-DD), added by migration `0004_add_today_count_to_stats`. `completeWorkSession` increments both the total and today's count (starting today at 1 when the stored date is not today in JST); `getStats` returns today's count as 0 whenever the stored date is not today in Japan time (UTC+9, date rolls over at JST midnight), so yesterday's count is never kept or shown. `resetStats` resets both counts. No per-date history rows.
- Per the user's request, the timer digits alone now sit at the exact centre of the clock circle: the digits are the only element in the centred flex block, and the status text (作業の時間 / 一時停止中 / 休憩の時間 / 休んでいます, blank while working) is absolutely positioned below centre (`top: calc(50% + 38px)`, horizontally centred, nowrap) so it stays inside the circle and no longer pushes the digits up. All other behaviour and styling — white shadow-only buttons, random coloured liquid, ring in the liquid's colour, chime/vibe vertical switch with no caption, 30 Bible quotes — is unchanged.

## Status text inside the clock removed (2026-11-11)
- Per the user's request, the status text shown under the timer digits inside the clock circle （作業の時間 / 休憩の時間 / 休んでいます / 一時停止中， and the blank line shown while working) was removed entirely. Only the timer digits remain, centred in the circle. The now-unused `accent` variable in `App.tsx` was also removed. All other behaviour and styling — timer, random coloured liquid, ring in the liquid's colour, chime/vibe vertical switch, total + today counts, 30 Bible quotes — is unchanged.

## Long-term data behavior
- **Refresh policy**: none; count (and quote index) change only when the user finishes a work session (or resets via the action).
- **Growth**: a single stats row (id=1) with an integer total counter, a today counter plus its JST date, and a nullable quote index; no history rows.
- **Ordering**: n/a.
- **Time semantics**: timer durations are fixed (25:00 work, 5:00 break); countdown computed from wall-clock timestamps so backgrounding the tab does not drift it.
