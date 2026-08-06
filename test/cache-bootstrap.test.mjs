import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const match = html.match(/<!-- Must run before[\s\S]*?<script>([\s\S]*?)<\/script>/);
assert.ok(match, 'cache bootstrap script must exist before the application module');
assert.ok(html.indexOf(match[0]) < html.indexOf('src="/src/main.tsx"'), 'cache bootstrap must precede main.tsx');

const profile = {
  babies: [{ id: 'baby-1' }],
  settings: { allergies: ['蛋'] },
  weeklyPlan: { monday: { dinner: ['旧餐单'] } },
  mealRulesRevision: 2,
  mealRulesStartupRevision: 1,
};
let stored = JSON.stringify({ state: profile, version: 42 });
const context = {
  localStorage: {
    getItem: () => stored,
    setItem: (_key, value) => { stored = value; },
  },
  console,
};

vm.runInNewContext(match[1], context);
const migrated = JSON.parse(stored);
assert.equal(migrated.state.weeklyPlan, null);
assert.deepEqual(migrated.state.babies, profile.babies);
assert.deepEqual(migrated.state.settings, profile.settings);
assert.equal(migrated.state.mealRulesStartupRevision, 3);

const once = stored;
vm.runInNewContext(match[1], context);
assert.equal(stored, once, 'the same startup revision must not migrate twice');

console.log('通过启动前餐单缓存迁移测试。');
