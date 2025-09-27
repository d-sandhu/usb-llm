/* eslint-env node */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { basename } from 'node:path';
import { readFile } from 'node:fs/promises';

const REG_PATH = new URL('../models/registry.json', import.meta.url);

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: npm run models:verify -- <path/to/model.gguf>');
    process.exit(2);
  }
  const target = args[0];
  const fileName = basename(target);

  let registry;
  try {
    const raw = await readFile(REG_PATH, 'utf8');
    registry = JSON.parse(raw);
  } catch (e) {
    console.error('Failed to read models/registry.json:', e instanceof Error ? e.message : e);
    process.exit(2);
  }
  const models = Array.isArray(registry?.models) ? registry.models : [];
  const entry = models.find((m) => m.file === fileName);

  if (!entry) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          reason: 'not-listed',
          file: fileName,
          message: 'File not found in registry.json; add an entry first.',
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  const sha = await sha256File(target);

  if (!entry.sha256) {
    console.log(
      JSON.stringify(
        {
          ok: null,
          file: fileName,
          id: entry.id,
          computed_sha256: sha,
          message: 'No sha256 in registry; copy this hash into models/registry.json',
        },
        null,
        2
      )
    );
    process.exit(0);
  }

  const ok = entry.sha256.toLowerCase() === sha.toLowerCase();
  console.log(
    JSON.stringify(
      {
        ok,
        file: fileName,
        id: entry.id,
        expected_sha256: entry.sha256,
        computed_sha256: sha,
      },
      null,
      2
    )
  );
  process.exit(ok ? 0 : 1);
}

function sha256File(path) {
  return new Promise((resolve, reject) => {
    const h = createHash('sha256');
    const s = createReadStream(path);
    s.on('error', reject);
    s.on('data', (chunk) => h.update(chunk));
    s.on('end', () => resolve(h.digest('hex')));
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
