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

作業回数は `standalone/data/pomodoro.db` のSQLiteに保存されます。
このDBはGitには入れません。standalone版の回数は0から始まり、
Muse の Space 側の現在の回数は自動では取り込まれません。

保存先を変える場合は `POMODORO_DB_PATH`、ポートを変える場合は
`PORT` 環境変数を使えます。
