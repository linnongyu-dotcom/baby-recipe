/* eslint-disable @typescript-eslint/no-explicit-any -- CloudBase CDN database results do not expose local declarations. */
import { getCloudBaseApp } from '@/lib/cloudbase';
import type { DataConflict, SyncableData, UserSpaceDocument } from '@/types/cloudSync';

export const USER_SPACES_COLLECTION = 'user_spaces';
export const SCHEMA_VERSION = 1 as const;
const DEBOUNCE_MS = 1800;

export function hasEffectiveData(data: Partial<SyncableData> | null | undefined): boolean {
  return Boolean(data && ((data.babies?.length || 0) + (data.userRecipes?.length || 0) +
    (data.customRecipes?.length || 0) + (data.favoriteIds?.length || 0) > 0 || data?.weeklyPlan));
}

export function compareVersions(localUpdatedAt: number, localRevision: number, cloud: UserSpaceDocument): 'cloud-newer' | 'local-newer' | 'same' {
  if (cloud.revision > localRevision || cloud.updatedAt > localUpdatedAt) return 'cloud-newer';
  if (cloud.revision < localRevision || cloud.updatedAt < localUpdatedAt) return 'local-newer';
  return 'same';
}

export function summarize(data: Partial<SyncableData>, updatedAt = 0) {
  return { babyCount: data.babies?.length || 0, recipeCount: (data.userRecipes?.length || 0) + (data.customRecipes?.length || 0), updatedAt };
}

function collection() {
  const app = getCloudBaseApp();
  if (!app) throw new Error('CloudBase 尚未配置');
  return app.database().collection(USER_SPACES_COLLECTION);
}

export async function fetchUserSpace(uid: string): Promise<UserSpaceDocument | null> {
  const result: any = await collection().where({ userId: uid }).limit(1).get();
  return result?.data?.[0] || null;
}

export async function writeUserSpace(uid: string, data: SyncableData, current?: UserSpaceDocument | null): Promise<UserSpaceDocument> {
  const now = Date.now();
  const document: UserSpaceDocument = {
    ...data, userId: uid, schemaVersion: SCHEMA_VERSION,
    revision: (current?.revision || 0) + 1,
    createdAt: current?.createdAt || now, updatedAt: now,
  };
  if (current?._id) {
    await collection().doc(current._id).set(document);
    return { ...document, _id: current._id };
  }
  const result: any = await collection().add(document);
  return { ...document, _id: result?.id };
}

export function chooseInitialAction(local: SyncableData, cloud: UserSpaceDocument | null): 'upload' | 'download' | 'conflict' | 'none' {
  const localHas = hasEffectiveData(local);
  const cloudHas = hasEffectiveData(cloud);
  if (localHas && !cloudHas) return 'upload';
  if (!localHas && cloudHas) return 'download';
  if (localHas && cloudHas) return 'conflict';
  return cloud ? 'download' : 'upload';
}

export function makeConflict(local: SyncableData, cloud: UserSpaceDocument, localUpdatedAt = 0): DataConflict {
  return { local, cloud, localSummary: summarize(local, localUpdatedAt), cloudSummary: summarize(cloud, cloud.updatedAt) };
}

export class SyncQueue {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private pending = false;
  constructor(private upload: () => Promise<void>, private onError: (error: unknown) => void) {}
  schedule() {
    this.pending = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), DEBOUNCE_MS);
  }
  async flush() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.running) { this.pending = true; return; }
    if (!this.pending) return;
    this.pending = false; this.running = true;
    try { await this.upload(); }
    catch (error) { this.pending = true; this.onError(error); }
    finally {
      this.running = false;
      if (this.pending && navigator.onLine) this.schedule();
    }
  }
  hasPending() { return this.pending || this.running; }
  async wait() { while (this.running) await new Promise(resolve => setTimeout(resolve, 50)); }
}
