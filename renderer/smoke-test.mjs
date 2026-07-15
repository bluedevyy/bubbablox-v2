// Render smoke test.
//
// Connects to a RUNNING renderer over its WebSocket and asks it to render one
// asset thumbnail, then reports whether a valid image came back. This exercises
// the full renderer -> RCC -> Lua -> upload path.
//
// Prereqs: the renderer AND its RCC must already be running (npm start), and
// config.json must be filled in. This cannot run in CI (there is no RCC there).
//
// Usage:
//   node smoke-test.mjs [assetId]
// Example:
//   node smoke-test.mjs 1818
//
// Exit code 0 = a thumbnail was returned; 1 = failure/timeout.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import WebSocket from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const conf = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json')).toString());

const assetId = Number(process.argv[2] || 1818);
const wsPort = conf.thumbnailWebsocketPort || 3040;
const url = `ws://127.0.0.1:${wsPort}?key=${encodeURIComponent(conf.authorization)}`;

console.log(`[smoke] connecting to ${url.replace(conf.authorization, '****')}`);
console.log(`[smoke] rendering asset thumbnail for id=${assetId}`);

const ws = new WebSocket(url);
const id = 'smoke-' + Date.now();

const done = (ok, msg) => {
  console.log(`[smoke] ${ok ? 'PASS' : 'FAIL'}: ${msg}`);
  try { ws.close(); } catch {}
  process.exit(ok ? 0 : 1);
};

const timeout = setTimeout(() => done(false, 'timed out after 90s (is the RCC running?)'), 90_000);

ws.on('open', () => {
  ws.send(JSON.stringify({ command: 'GenerateThumbnailAsset', args: [assetId], id }));
});

ws.on('message', (raw) => {
  let res;
  try { res = JSON.parse(raw.toString()); } catch { return; }
  if (res.id !== id) return;
  clearTimeout(timeout);
  if (res.status !== 200) return done(false, `renderer returned status ${res.status} (${res.code || 'no code'})`);
  const b64 = res.data && res.data.thumbnail;
  if (typeof b64 !== 'string' || b64.length < 100) return done(false, 'response had no thumbnail data');
  const isPng = Buffer.from(b64, 'base64').slice(0, 4).toString('hex') === '89504e47';
  done(isPng, isPng ? `got a ${b64.length}-char base64 PNG` : 'thumbnail was not a PNG');
});

ws.on('error', (e) => { clearTimeout(timeout); done(false, `websocket error: ${e.message} (is the renderer running?)`); });
