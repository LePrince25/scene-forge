#!/usr/bin/env node
/* Render a scene-forge spec to PNG with headless Chrome.
 *
 * node scripts/render.mjs --root out --spec plan.json --camera hero --size 3840x2160 --out out/hero_4k.png
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import puppeteer from 'puppeteer-core';
import { serve } from './_serve.mjs';
import { findChrome, launchArgs } from './_chrome.mjs';
import { ensureAssets } from './_assets.mjs';

const t0 = Date.now();

function done(obj, code = 0) {
  console.log(JSON.stringify({ ...obj, seconds: Math.round((Date.now() - t0) / 100) / 10 }, null, 2));
  process.exit(code);
}

function die(msg) {
  done({ ok: false, error: msg }, 1);
}

let args;
try {
  args = parseArgs({
    options: {
      root: { type: 'string', default: 'out' },
      spec: { type: 'string', default: 'plan.json' },
      camera: { type: 'string' },
      look: { type: 'string', default: 'hero' },
      cut: { type: 'string' },
      size: { type: 'string', default: '3840x2160' },
      out: { type: 'string' },
      headed: { type: 'boolean', default: false },
      timeout: { type: 'string', default: '180' },
      'no-assets': { type: 'boolean', default: false },
    },
  }).values;
} catch (e) {
  die(e.message);
}

const root = path.resolve(args.root);
const spec = args.spec;
const camera = args.camera || null;
const look = args.look;
const cut = args.cut ? Number(args.cut) : null;
const [w, h] = (args.size || '3840x2160').toLowerCase().split('x').map((n) => parseInt(n, 10));
if (!w || !h) die(`invalid --size "${args.size}" (expected WxH, e.g. 3840x2160)`);
const timeoutSec = Number(args.timeout) || 180;
const out = path.resolve(args.out || path.join(root, `render_${w}x${h}.png`));

if (!fs.existsSync(root)) die(`folder not found: ${root}`);
const specPath = path.isAbsolute(spec) ? spec : path.join(root, spec);
if (!fs.existsSync(specPath)) die(`spec not found: ${specPath}`);

if (!args['no-assets']) ensureAssets(root);
if (!fs.existsSync(path.join(root, 'viewer.html'))) die('viewer.html missing from the root folder');

const chrome = findChrome();
if (!chrome) die('Chrome/Chromium/Edge not found. Install Chrome or set CHROME_PATH=/path/to/chrome');

let browser;
let server;
try {
  server = await serve(root);
  const qs = new URLSearchParams({ spec, look, ui: '0' });
  if (camera) qs.set('camera', camera);
  if (cut) qs.set('cut', String(cut));
  const url = `${server.url}/viewer.html?${qs.toString()}`;

  browser = await puppeteer.launch({
    executablePath: chrome,
    headless: !args.headed,
    args: launchArgs(),
    protocolTimeout: Math.max(120000, timeoutSec * 1000),
  });
  const page = await browser.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') process.stderr.write(`[page] ${m.text()}\n`);
  });
  page.on('pageerror', (e) => process.stderr.write(`[page] ${e.message}\n`));

  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction('window.__sceneReady === true || window.__error', { timeout: timeoutSec * 1000 });
  const pageError = await page.evaluate(() => window.__error || null);
  if (pageError) die(`viewer error: ${pageError}`);

  await new Promise((r) => setTimeout(r, 800));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out, type: 'png', captureBeyondViewport: false });

  const size = fs.statSync(out).size;
  done({ ok: true, out, width: w, height: h, camera: camera || 'default', look, cut, bytes: size });
} catch (e) {
  die(e && e.message ? e.message : String(e));
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server) server.close();
}
