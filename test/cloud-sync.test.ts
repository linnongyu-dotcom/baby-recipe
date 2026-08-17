/* eslint-disable @typescript-eslint/no-explicit-any -- deliberately incomplete fixtures exercise malformed legacy data. */
import assert from 'node:assert/strict';
import { chooseInitialAction, compareVersions, hasEffectiveData, SyncQueue } from '../src/services/cloudSyncService.ts';
import { GUEST_STORAGE_KEY, LEGACY_STORAGE_KEY, LOCAL_MIGRATION_KEY, identityStorage, migrateLegacyStorage, normalizeStableIds, setActiveUid, storageKeyFor } from '../src/services/localSpaceService.ts';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}
const empty: any = { babies: [], currentBabyId: null, userRecipes: [], customRecipes: [], favoriteIds: [], weeklyPlan: null, settings: { babyAge: null, allergies: [], dislikes: [], likes: [] }, isSetupComplete: false, babyName: '', foodRecords: [], feedingMonth: 6 };
const populated = { ...empty, babies: [{ id: 'baby-1', birthDate: '2025-01-01' }], userRecipes: [{ id: 'recipe-1' }] } as any;

// Legacy migration is non-destructive and idempotent.
const memory = new MemoryStorage(); memory.setItem(LEGACY_STORAGE_KEY, '{"state":{"babies":[]}}');
assert.equal(migrateLegacyStorage(memory), true); assert.equal(memory.getItem(GUEST_STORAGE_KEY), memory.getItem(LEGACY_STORAGE_KEY));
memory.setItem(LEGACY_STORAGE_KEY, 'changed'); assert.equal(migrateLegacyStorage(memory), false); assert.notEqual(memory.getItem(GUEST_STORAGE_KEY), 'changed');
assert.equal(memory.getItem(LOCAL_MIGRATION_KEY), '1');

// Stable IDs are repaired once and preserved on subsequent normalization.
const repaired: any = normalizeStableIds({ babies: [{ id: '', birthDate: '2025-01-01' }], userRecipes: [{ id: '', name: '粥' }] });
const again: any = normalizeStableIds(repaired); assert.ok(repaired.babies[0].id); assert.equal(again.babies[0].id, repaired.babies[0].id); assert.equal(again.userRecipes[0].id, repaired.userRecipes[0].id);

// UID spaces are isolated and switching never copies one account to another.
Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true });
setActiveUid('A'); identityStorage.setItem('', 'account-a'); setActiveUid('B'); assert.equal(identityStorage.getItem(''), null); identityStorage.setItem('', 'account-b');
setActiveUid('A'); assert.equal(identityStorage.getItem(''), 'account-a'); setActiveUid(null); assert.equal(storageKeyFor(null), GUEST_STORAGE_KEY); assert.equal(identityStorage.getItem(''), null);

assert.equal(hasEffectiveData(empty), false); assert.equal(hasEffectiveData(populated), true);
assert.equal(chooseInitialAction(populated, null), 'upload');
assert.equal(chooseInitialAction(empty, { ...populated, userId: 'u', revision: 1, updatedAt: 2, createdAt: 1, schemaVersion: 1 }), 'download');
assert.equal(chooseInitialAction(populated, { ...populated, userId: 'u', revision: 1, updatedAt: 2, createdAt: 1, schemaVersion: 1 }), 'conflict');
const cloud: any = { revision: 3, updatedAt: 30 }; assert.equal(compareVersions(20, 2, cloud), 'cloud-newer'); assert.equal(compareVersions(40, 4, cloud), 'local-newer'); assert.equal(compareVersions(30, 3, cloud), 'same');

// Debounce and an edit during upload result in one follow-up upload; failures remain retryable.
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });
let uploads = 0; let release!: () => void;
const queue = new SyncQueue(async () => { uploads++; if (uploads === 1) await new Promise<void>(resolve => { release = resolve; }); }, () => undefined);
queue.schedule(); const first = queue.flush(); queue.schedule(); release(); await first; await new Promise(resolve => setTimeout(resolve, 1900)); assert.equal(uploads, 2);
let attempts = 0; const retry = new SyncQueue(async () => { attempts++; if (attempts === 1) throw new Error('offline'); }, () => undefined);
retry.schedule(); await retry.flush(); assert.equal(retry.hasPending(), true); await retry.flush(); assert.equal(attempts, 2);

// The whitelist shape intentionally excludes public recipes and temporary UI state.
assert.equal('publicRecipes' in empty, false); assert.equal('loading' in empty, false);
console.log('cloud-sync tests passed');
