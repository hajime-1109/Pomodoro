# ポモドーロ standalone版

Muse の Space の外でも、クローンしたこのリポジトリだけで使える版です。
画面は元の `client/src/` をそのまま使い、Space専用SDKの通信部分だけを
ローカル実装に差し替えています。

## 必要なもの

- Node.js 22.5以上（Node.js 24推奨）
- npm

## 起動

```sh
cd standalone
npm install
npm run build
npm start
```

ブラウザで `http://127.0.0.1:8787` を開きます。

## 開発モード

```sh
cd standalone
npm install
npm run dev
```

開発画面は `http://127.0.0.1:5173`、APIは自動で
`http://127.0.0.1:8787` に起動します。

## データ

ローカル版の作業回数は `standalone/data/pomodoro.db` のSQLiteに保存されます。
このDBはGitには入れません。standalone版の回数は0から始まり、
Muse の Space 側の現在の回数は自動では取り込まれません。

保存先を変える場合は `POMODORO_DB_PATH`、ポートを変える場合は
`PORT` 環境変数を使えます。

## Vercelにデプロイする

Vercelはローカルファイルを永続化できないので、Vercel版では保存先を
Turso (libSQL) に切り替えます。画面とAPIの口 (`POST /actions`) は
ローカル版と共通で、`api/actions.js` がVercel Functionとして動きます。

手順:

1. Turso (https://turso.tech) でデータベースを作成し、
   Database URL (`libsql://...`) と Auth Token を控える
2. Vercelで GitHub リポジトリ `hajime-1109/Pomodoro` を Import し、
   Root Directory を `standalone` に設定する
3. プロジェクトの環境変数に次を設定する (Production):
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
4. デプロイ後、これまでの回数を引き継ぐ場合は一度だけ seed を流す:

   ```sh
   cd standalone
   TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... \
   SEED_COMPLETED_COUNT=21 SEED_TODAY_COUNT=3 \
   SEED_TODAY_DATE=2026-11-13 SEED_QUOTE_INDEX=28 \
   node scripts/seed.mjs
   ```

   数値は移行時点のSpace側の値を入れる (SEED_TODAY_DATE は移行日の
   日本時間の日付)。

以降は `main` ブランチへの push で自動デプロイされます。
環境変数が未設定の場合、APIは 503 を返し、画面の回数は表示されません。

## バックグラウンド通知 (任意)

アプリを閉じていても終了時刻に通知を受け取るには、サーバー予約の
Web Push を有効にします。タイマー開始時に `api/actions.js` が予約を
Turso に保存し、Upstash QStash が終了時刻に `api/push-fire` を呼んで
Push を送信します (Service Worker 自体には時刻で起きる機能が無いため、
送信役が別に要ります)。

追加の環境変数 (Production):

- `QSTASH_TOKEN` — Upstash QStash のトークン
- `PUSH_CALLBACK_SECRET` — QStash からのコールバック認証用の秘密文字列
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — Web Push の VAPID 鍵ペア
  (公開鍵は `src/push.ts` に埋め込んだものと一致させる)

未設定の場合は予約が保存されるだけで発火せず、アプリ内の
チャイム/バイブ動作に影響しません。
