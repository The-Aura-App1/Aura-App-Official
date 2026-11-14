// Downloads the post fonts listed in src/utils/postFonts.json into
// public/fonts/post/<id>.woff2 (Latin, regular weight) from Fontsource.
// The files are committed, so this only runs when the list changes:
//   node scripts/fetch-post-fonts.mjs
// All of them are open-source Google Fonts (SIL OFL or Apache 2.0).
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const fonts = JSON.parse(fs.readFileSync(path.join(root, 'src/utils/postFonts.json'), 'utf8'));
const dir = path.join(root, 'public/fonts/post');
fs.mkdirSync(dir, { recursive: true });

const failed = [];
for (const { id } of fonts) {
  const file = path.join(dir, `${id}.woff2`);
  if (fs.existsSync(file)) continue;
  let ok = false;
  for (const weight of [400, 500, 300, 700]) {
    const res = await fetch(`https://cdn.jsdelivr.net/fontsource/fonts/${id}@latest/latin-${weight}-normal.woff2`);
    if (!res.ok) continue;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.subarray(0, 4).toString('latin1') !== 'wOF2') continue;
    fs.writeFileSync(file, buf);
    ok = true;
    break;
  }
  if (!ok) failed.push(id);
}
console.log(failed.length ? `Not found: ${failed.join(', ')}` : 'All fonts present.');
