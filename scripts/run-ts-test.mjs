import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const entry = process.argv[2];
if (!entry) {
  console.error('Usage: node scripts/run-ts-test.mjs <test-file>');
  process.exit(2);
}

const directory = await mkdtemp(join(tmpdir(), 'baby-recipe-test-'));
const output = join(directory, 'test.mjs');

try {
  await build({ entryPoints: [resolve(entry)], outfile: output, bundle: true, platform: 'node', format: 'esm' });
  const result = spawnSync(process.execPath, [output], { stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
} finally {
  await rm(directory, { recursive: true, force: true });
}
