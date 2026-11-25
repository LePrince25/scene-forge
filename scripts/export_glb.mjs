#!/usr/bin/env node
/* Export the built scene to GLB from headless Chrome (textures included).
 *
 * node scripts/export_glb.mjs --root out --spec plan.json --out out/model.glb
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import puppeteer from 'puppeteer-core';
import { serve } from './_serve.mjs';
import { findChrome, launchArgs } from './_chrome.mjs';
import { ensureAssets } from './_assets.mjs';

const t0 = Date.now();
const done = (obj, code = 0) => {
  console.log(JSON.stringify({ ...obj, seconds: Math.round((Date.now() - t0) / 100) / 10 }, null, 2));
  process.exit(code);
};
const die = (msg) => done({ ok: false, error: msg }, 1);

let args;
try {
  args = parseArgs({
    options: {
      root: { type: 'string', default: 'out' },
      spec: { type: 'string', default: 'plan.json' },
      cut: { type: 'string' },
      out: { type: 'string' },
      timeout: { type: 'string', default: '180' },
    },
  }).values;
} catch (e) {
  die(e.message);
}

const root = path.resolve(args.root);
const spec = args.spec;
const cut = args.cut ? Number(args.cut) : null;
const out = path.resolve(args.out || path.join(root, 'model.glb'));
const timeoutSec = Number(args.timeout) || 180;

if (!fs.existsSync(path.join(root, spec))) die(`spec not found: ${path.join(root, spec)}`);
ensureAssets(root);

const chrome = findChrome();
if (!chrome) die('Chrome/Chromium/Edge not found. Install Chrome or set CHROME_PATH=/path/to/chrome');

let browser;
let server;
try {
  server = await serve(root);
  const qs = new URLSearchParams({ spec, ui: '0' });
  if (cut) qs.set('cut', String(cut));
  browser = await puppeteer.launch({
    executablePath: chrome,
    headless: true,
    args: launchArgs(),
    protocolTimeout: Math.max(120000, timeoutSec * 1000),
  });
  const page = await browser.newPage();
  page.on('pageerror', (e) => process.stderr.write(`[page] ${e.message}\n`));
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  await page.goto(`${server.url}/viewer.html?${qs.toString()}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction('window.__sceneReady === true || window.__error', { timeout: timeoutSec * 1000 });
  const pageError = await page.evaluate(() => window.__error || null);
  if (pageError) die(`viewer error: ${pageError}`);

  const b64 = await page.evaluate(async () => {
    const buf = await window.__exportGLBBytes();
    const u8 = new Uint8Array(buf);
    const chunks = [];
    const CH = 0x8000;
    for (let i = 0; i < u8.length; i += CH) chunks.push(String.fromCharCode.apply(null, u8.subarray(i, i + CH)));
    return btoa(chunks.join(''));
  });

  const bytes = Buffer.from(b64, 'base64');
  if (bytes.length < 12 || bytes.toString('ascii', 0, 4) !== 'glTF') {
    die(`export produced an invalid GLB (${bytes.length} bytes)`);
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, bytes);
  done({ ok: true, out, bytes: bytes.length, cut });
} catch (e) {
  die(e && e.message ? e.message : String(e));
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server) server.close();
}
