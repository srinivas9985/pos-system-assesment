import { create } from 'zustand';

interface ConflictRecord {
  entityType: 'product' | 'category' | 'tag';
  entityId: number;
  localVersion: number;
  serverVersion: number;
  detectedAt: string;
}

interface SyncState {
  lastVersion: number;
  connected: boolean;
  pendingConflicts: ConflictRecord[];
  setConnected: (connected: boolean) => void;
  updateVersion: (version: number) => void;
  addConflict: (conflict: ConflictRecord) => void;
  clearConflicts: () => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  lastVersion: 0,
  connected: false,
  pendingConflicts: [],
  setConnected: (connected) => set({ connected }),
  updateVersion: (version) => set({ lastVersion: version }),
  addConflict: (conflict) =>
    set((state) => {
      const next = [...state.pendingConflicts, conflict];
      // Cap history so long-running sessions do not grow memory without bound.
      return { pendingConflicts: next.length > 100 ? next.slice(-100) : next };
    }),
  clearConflicts: () => set({ pendingConflicts: [] }),
}));
