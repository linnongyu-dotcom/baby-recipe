import { useStore, type AppState } from '@/store/useStore';
import { useAuthStore } from '@/stores/authStore';
import { useSyncStore } from '@/stores/syncStore';
import type { SyncableData, UserSpaceDocument } from '@/types/cloudSync';
import { fetchUserSpace, makeConflict, chooseInitialAction, SyncQueue, writeUserSpace } from './cloudSyncService';
import { restoreSession, signOut } from './authService';
import { setActiveUid, storageKeyFor } from './localSpaceService';

const fields: (keyof SyncableData)[] = ['babies', 'currentBabyId', 'userRecipes', 'customRecipes', 'favoriteIds', 'weeklyPlan', 'settings', 'isSetupComplete', 'babyName', 'foodRecords', 'feedingMonth'];
export function extractSyncable(state: AppState): SyncableData {
  return Object.fromEntries(fields.map(key => [key, state[key]])) as unknown as SyncableData;
}
const apply = (data: SyncableData) => useStore.setState(Object.fromEntries(fields.map(key => [key, data[key]])) as Partial<AppState>);
const cached = (uid: string): SyncableData | null => {
  try { return JSON.parse(localStorage.getItem(storageKeyFor(uid)) || 'null')?.state || null; } catch { return null; }
};
interface SyncMeta { revision: number; updatedAt: number; payload: string }
const metaKey = (uid: string) => `${storageKeyFor(uid)}:sync-meta`;
const readMeta = (uid: string): SyncMeta | null => { try { return JSON.parse(localStorage.getItem(metaKey(uid)) || 'null'); } catch { return null; } };
const saveMeta = (uid: string, doc: UserSpaceDocument) => localStorage.setItem(metaKey(uid), JSON.stringify({ revision: doc.revision, updatedAt: doc.updatedAt, payload: JSON.stringify(extractSyncable(useStore.getState())) }));

let cloud: UserSpaceDocument | null = null;
let unsubscribe: (() => void) | null = null;
let applying = false;

const queue = new SyncQueue(async () => {
  const uid = useAuthStore.getState().user?.uid;
  if (!uid) return;
  useSyncStore.getState().set({ status: 'syncing', error: null });
  cloud = await writeUserSpace(uid, extractSyncable(useStore.getState()), cloud);
  saveMeta(uid, cloud);
  useSyncStore.getState().set({ status: 'synced', dirty: false, lastSyncedAt: cloud.updatedAt });
}, error => useSyncStore.getState().set({
  status: navigator.onLine ? 'error' : 'offline', dirty: true,
  error: error instanceof Error ? error.message : '同步失败',
}));

function watchChanges() {
  unsubscribe?.();
  let previous = JSON.stringify(extractSyncable(useStore.getState()));
  unsubscribe = useStore.subscribe(state => {
    const next = JSON.stringify(extractSyncable(state));
    if (next === previous) return;
    previous = next;
    if (applying || !useAuthStore.getState().user) return;
    useSyncStore.getState().set({ dirty: true, status: navigator.onLine ? 'syncing' : 'offline' });
    queue.schedule();
  });
}

async function establish(uid: string) {
  const userCache = cached(uid);
  const guest = extractSyncable(useStore.getState());
  setActiveUid(uid);
  if (userCache) apply(userCache); else apply(guest);
  await useStore.persist.rehydrate();
  const local = extractSyncable(useStore.getState());
  watchChanges();
  cloud = await fetchUserSpace(uid);
  const meta = readMeta(uid);
  if (userCache && cloud && meta) {
    const localDirty = meta.payload !== JSON.stringify(local);
    const cloudChanged = cloud.revision > meta.revision || cloud.updatedAt > meta.updatedAt;
    if (localDirty && cloudChanged) {
      useSyncStore.getState().set({ conflict: makeConflict(local, cloud, meta.updatedAt), status: 'local-only', dirty: true });
    } else if (localDirty) {
      useSyncStore.getState().set({ dirty: true }); queue.schedule(); await queue.flush();
    } else if (cloudChanged) {
      applying = true; apply(cloud); applying = false; saveMeta(uid, cloud);
      useSyncStore.getState().set({ status: 'synced', dirty: false, lastSyncedAt: cloud.updatedAt });
    } else useSyncStore.getState().set({ status: 'synced', dirty: false, lastSyncedAt: meta.updatedAt });
    return;
  }
  const action = chooseInitialAction(local, cloud);
  if (action === 'conflict' && cloud) {
    useSyncStore.getState().set({ conflict: makeConflict(local, cloud), status: 'local-only' });
  } else if (action === 'download' && cloud) {
    applying = true; apply(cloud); applying = false;
    saveMeta(uid, cloud);
    useSyncStore.getState().set({ status: 'synced', dirty: false, lastSyncedAt: cloud.updatedAt });
  } else if (action === 'upload') {
    useSyncStore.getState().set({ dirty: true }); queue.schedule(); await queue.flush();
  }
}

export async function initializeSync() {
  try {
    const user = await restoreSession();
    useAuthStore.getState().setUser(user);
    if (user) await establish(user.uid);
  } catch (error) {
    useSyncStore.getState().set({ status: navigator.onLine ? 'error' : 'offline', error: error instanceof Error ? error.message : '初始化同步失败' });
  } finally { useAuthStore.getState().setLoading(false); }
  window.addEventListener('online', () => { if (useSyncStore.getState().dirty) queue.schedule(); });
  window.addEventListener('offline', () => { if (useAuthStore.getState().user) useSyncStore.getState().set({ status: 'offline' }); });
  window.addEventListener('beforeunload', () => { if (queue.hasPending()) void queue.flush(); });
}

export async function activateUser(user: { uid: string; email?: string }) {
  useAuthStore.getState().setUser(user); await establish(user.uid);
}
export async function syncNow() { queue.schedule(); await queue.flush(); }
export async function resolveConflict(choice: 'cloud' | 'local') {
  const conflict = useSyncStore.getState().conflict;
  if (!conflict) return;
  if (choice === 'cloud') { applying = true; apply(conflict.cloud); applying = false; cloud = conflict.cloud; }
  else { cloud = conflict.cloud; useSyncStore.getState().set({ dirty: true }); queue.schedule(); await queue.flush(); }
  if (cloud) saveMeta(useAuthStore.getState().user!.uid, cloud);
  useSyncStore.getState().set({ conflict: null, status: 'synced', dirty: false, lastSyncedAt: cloud?.updatedAt || Date.now() });
}
export async function logoutUser() {
  await queue.wait();
  const warning = queue.hasPending() || useSyncStore.getState().dirty;
  await signOut(); unsubscribe?.(); unsubscribe = null; cloud = null;
  setActiveUid(null); useAuthStore.getState().setUser(null);
  await useStore.persist.rehydrate();
  useSyncStore.getState().set({ status: 'local-only', dirty: false, conflict: null, error: warning ? '部分修改尚未同步到云端。这些修改仍保存在本机。' : null });
  return warning;
}
