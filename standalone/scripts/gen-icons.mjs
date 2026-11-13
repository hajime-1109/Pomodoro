// Generate the PWA icon PNGs into public/ at build time.
//
// The icons are the same artwork as the Muse Space icon (originally a
// binary .webp). The GitHub snapshot sync used for this repo can only
// carry text files, so the PNGs are stored base64-encoded under
// assets/ and decoded here before Vite copies public/ into dist/.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const standaloneDir = path.resolve(here, "..");
const assetsDir = path.join(standaloneDir, "assets");
const publicDir = path.join(standaloneDir, "public");

const ICONS = [
  "icon-192.png",
  "icon-512.png",
  "icon-maskable-512.png",
];

fs.mkdirSync(publicDir, { recursive: true });

for (const name of ICONS) {
  const b64Path = path.join(assetsDir, `${name}.b64`);
  const base64 = fs.readFileSync(b64Path, "utf8").trim();
  const bytes = Buffer.from(base64, "base64");
  fs.writeFileSync(path.join(publicDir, name), bytes);
  console.log(`gen-icons: public/${name} (${bytes.length} bytes)`);
}
