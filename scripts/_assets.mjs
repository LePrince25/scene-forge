import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ASSETS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets');

// Always refresh the runtime files: out/ is generated, assets/ is the source of truth.
export function ensureAssets(root) {
  fs.mkdirSync(root, { recursive: true });
  for (const f of ['viewer.html', 'scene-core.js']) {
    fs.copyFileSync(path.join(ASSETS, f), path.join(root, f));
  }
  return true;
}
