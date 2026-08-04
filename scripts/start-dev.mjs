import { execFileSync, spawn } from 'node:child_process';
import process from 'node:process';

function git(args, fallback) {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim() || fallback;
  } catch {
    return fallback;
  }
}

const branch = git(['branch', '--show-current'], '(detached HEAD)');
const commit = git(['rev-parse', '--short', 'HEAD'], 'unknown');
const dirty = git(['status', '--porcelain'], '') ? ' + uncommitted changes' : '';

console.log('\nBaby Recipe development build');
console.log(`  source: ${branch} @ ${commit}${dirty}`);
console.log('  route:  http://localhost:5173/recipe');
console.log('  note:   strict port mode is enabled; an existing server on 5173 causes an error.\n');

const viteBin = process.platform === 'win32'
  ? 'node_modules/.bin/vite.cmd'
  : 'node_modules/.bin/vite';
const child = spawn(viteBin, ['--host', '0.0.0.0', '--port', '5173', '--strictPort', ...process.argv.slice(2)], {
  stdio: 'inherit',
});

child.on('error', (error) => {
  console.error(`Unable to start Vite: ${error.message}`);
  process.exitCode = 1;
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
