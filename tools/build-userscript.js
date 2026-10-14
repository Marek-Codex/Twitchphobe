/* ============================================================================
 * build-userscript.js  —  regenerates Twitchphobe.user.js from source.
 *
 * Why this exists: the userscript has to inline net.js + patch.js as STRINGS
 * (a userscript has no chrome-extension:// resource URLs). Rather than hand-
 * copy them and let them drift, this reads the real src/ files and splices
 * them in with JSON.stringify (which escapes backticks, ${...}, backslashes —
 * all the nasty stuff — correctly, unlike doing it by hand at 3am).
 *
 * Usage:   node tools/build-userscript.js
 * Node only. End users never run this — Twitchphobe.user.js is committed
 * ready-to-install. This is for US, the maintainer, so the two builds of the
 * patch can't silently diverge. Which they would. They always do.
 * ==========================================================================*/
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''); // strip BOM if any

const template = read(path.join(__dirname, 'Twitchphobe.user.template.js'));
const net = read(path.join(root, 'src', 'net.js'));
const patch = read(path.join(root, 'src', 'patch.js'));

const NET_TOKEN = '"__NET_JS__"';
const PATCH_TOKEN = '"__PATCH_JS__"';

if (!template.includes(NET_TOKEN) || !template.includes(PATCH_TOKEN)) {
  console.error('Template markers missing — refusing to build a broken userscript.');
  process.exit(1);
}

const out = template
  .replace(NET_TOKEN, JSON.stringify(net))
  .replace(PATCH_TOKEN, JSON.stringify(patch));

const dest = path.join(root, 'userscript', 'Twitchphobe.user.js');
fs.writeFileSync(dest, out);

console.log(
  `Built Twitchphobe.user.js — ${Buffer.byteLength(out)} bytes ` +
  `(net ${Buffer.byteLength(net)}B + patch ${Buffer.byteLength(patch)}B inlined)`
);
