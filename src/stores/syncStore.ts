import { create } from 'zustand';
import type { DataConflict, SyncStatus } from '@/types/cloudSync';

interface SyncState {
  status: SyncStatus;
  dirty: boolean;
  lastSyncedAt: number | null;
  error: string | null;
  conflict: DataConflict | null;
  set: (value: Partial<Omit<SyncState, 'set'>>) => void;
}
export const useSyncStore = create<SyncState>(set => ({
  status: 'local-only', dirty: false, lastSyncedAt: null, error: null, conflict: null,
  set: value => set(value),
}));
