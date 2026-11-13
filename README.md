# ポモドーロ

Muse の Space として作った個人用ポモドーロタイマー（フルスタック）。
白ニューモフィズム、25分作業 / 5分休憩、時計の中に飲み物の液体が溜まる演出、
セッション回数（累計＋今日）はサーバー側に保存される。

## クローンして使う

ルート直下は Muse の Space 用ソースなので、そのままでは Muse の外で
起動できません。クローンして使う場合は `standalone/` を使います。

必要なものは Node.js 22.5以上（Node.js 24推奨）と npm です。

```sh
git clone https://github.com/hajime-1109/Pomodoro.git
cd Pomodoro/standalone
npm install
npm run build
npm start
```

ブラウザで `http://127.0.0.1:8787` を開きます。
詳しくは [`standalone/README.md`](standalone/README.md) を見てください。

standalone版は元の画面 (`client/src/`) をそのまま使い、Space専用SDKの
通信とDBだけをローカル実装に差し替えたものです。作業回数は
`standalone/data/pomodoro.db` に保存され、0から始まります。

## このリポジトリについて

- Muse の GitHub コネクタ経由で、Space のソースコードをスナップショットとして
  コミットしているもの。ローカルの git 履歴とは同期していない。
- 同期のたびに、その時点のソースファイル一式が1コミットになる。
- 含まれるもの: `client/` `server/` `drizzle/` と各種設定ファイル、
  それと Muse の外で動かすための `standalone/`。
- 含まれないもの:
  - `app.db`（利用データのDB。本人の実データなのでリポジトリには入れない）
  - `node_modules/`、ビルド成果物（`client/dist` など）、監査ログ
  - `icon.webp`（バイナリのため、この同期方式では送れない。アイコンは Space 側で管理）

## 構成

- `client/src/` — 画面（React）
- `server/src/` — Space側のサーバーアクションとスキーマ
- `drizzle/` — Space側DBのマイグレーション
- `space.json` — Space の定義
- `standalone/` — Muse の外で動かすためのローカル版
