/**
 * FileManager Zustand Store
 *
 * Clipboard state + actions for file copy/cut/paste operations.
 */
import { createAppStoreWithActions, memoSelector, registerStateAdapter, invalidateStateCache } from '../../os/createAppStore';
import { FSNode } from '../../os/types';
import * as FileSystem from '../../os/FileSystemService';
import { transferNodesToDirectory } from './utils/fileOperations';

// ---- Types ----

export interface FileManagerSettings {
  useMobileData: boolean;
  showHiddenFiles: boolean;
  showSystemHiddenFiles: boolean;
  autoCollectDocuments: boolean;
}

interface FileManagerState {
  clipboardItems: FSNode[];
  clipboardOperation: 'copy' | 'cut' | null;
  favoritePaths: string[];
  favoriteIds: Record<string, string>;
  privateIds: string[];
  settings: FileManagerSettings;
}

interface FileManagerActions {
  copy: (items: FSNode[]) => void;
  cut: (items: FSNode[]) => void;
  paste: (destPath: string) => Promise<boolean>;
  clearClipboard: () => void;
  addFavorites: (items: FSNode[]) => boolean;
  removeFavorite: (path: string) => void;
  setPrivate: (items: FSNode[]) => boolean;
  removePrivate: (id: string) => void;
  toggleSetting: (key: keyof FileManagerSettings) => void;
}

// ---- Initial state ----

export const DEFAULT_FILE_MANAGER_SETTINGS: FileManagerSettings = {
  useMobileData: false,
  showHiddenFiles: false,
  showSystemHiddenFiles: false,
  autoCollectDocuments: true,
};

export function normalizeFileManagerSettings(
  settings: Partial<FileManagerSettings> | null | undefined,
): FileManagerSettings {
  return {
    ...DEFAULT_FILE_MANAGER_SETTINGS,
    ...(settings ?? {}),
  };
}

export function normalizeFavoriteIds(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0,
  ));
}

const initialState: FileManagerState = {
  clipboardItems: [],
  clipboardOperation: null,
  favoritePaths: [],
  favoriteIds: {},
  privateIds: [],
  settings: DEFAULT_FILE_MANAGER_SETTINGS,
};

// ---- Store ----

const fileManagerStore = createAppStoreWithActions<FileManagerState, FileManagerActions>(
  'file_manager',
  initialState,
  (set, get) => ({
    copy(items: FSNode[]) {
      set({ clipboardItems: items.map(item => ({ ...item })), clipboardOperation: 'copy' });
    },

    cut(items: FSNode[]) {
      set({ clipboardItems: items.map(item => ({ ...item })), clipboardOperation: 'cut' });
    },

    async paste(destPath: string): Promise<boolean> {
      const { clipboardOperation, clipboardItems } = get();
      if (!clipboardOperation || clipboardItems.length === 0) return false;

      try {
        const success = await transferNodesToDirectory(
          clipboardItems, destPath, clipboardOperation === 'cut' ? 'move' : 'copy',
        );
        if (!success) return false;

        // A newer copy/cut (or explicit cancel) can happen during async IO.
        // Never consume that replacement clipboard when this request finishes.
        if (clipboardOperation === 'cut' && get().clipboardOperation === clipboardOperation &&
            get().clipboardItems === clipboardItems) {
          set({ clipboardItems: [], clipboardOperation: null });
        }

        return true;
      } catch (error) {
        console.error('[FileManager] Paste failed:', error);
        return false;
      }
    },

    clearClipboard() {
      set({ clipboardItems: [], clipboardOperation: null });
    },

    addFavorites(items: FSNode[]) {
      const valid = items.filter(item => item?.path && FileSystem.getNode(item.path)?.id === item.id);
      const paths = valid.map(item => item.path);
      if (paths.length === 0 || paths.length !== items.length) return false;
      set(state => {
        const favoritePaths = [...state.favoritePaths];
        const favoriteIds = normalizeFavoriteIds(state.favoriteIds);
        for (const item of valid) {
          if (favoritePaths.some(path => favoriteIds[path] === item.id)) continue;
          const previousId = favoriteIds[item.path];
          if (previousId && previousId !== item.id) {
            const preservedKey = `favorite-id:${encodeURIComponent(previousId)}`;
            if (!favoritePaths.includes(preservedKey)) favoritePaths.push(preservedKey);
            favoriteIds[preservedKey] = previousId;
          }
          if (!favoritePaths.includes(item.path)) favoritePaths.push(item.path);
          favoriteIds[item.path] = item.id;
        }
        return { favoritePaths, favoriteIds };
      });
      return true;
    },

    removeFavorite(path: string) {
      set(state => {
        const favoriteIds = normalizeFavoriteIds(state.favoriteIds);
        delete favoriteIds[path];
        return { favoritePaths: state.favoritePaths.filter(item => item !== path), favoriteIds };
      });
    },

    setPrivate(items: FSNode[]) {
      const valid = items.filter(item => item?.path && FileSystem.getNode(item.path)?.id === item.id);
      if (valid.length === 0 || valid.length !== items.length) return false;
      set(state => ({ privateIds: Array.from(new Set([...state.privateIds, ...valid.map(item => item.id)])) }));
      return true;
    },

    removePrivate(id: string) {
      set(state => ({ privateIds: state.privateIds.filter(item => item !== id) }));
    },

    toggleSetting(key) {
      set(state => {
        const settings = normalizeFileManagerSettings(state.settings);
        return { settings: { ...settings, [key]: !settings[key] } };
      });
    },
  }),
  {
    afterHydration: () => {
      // Older persisted FileManager states predate the settings object. Hydration is
      // synchronous with localStorage, so defer until the store binding is assigned.
      queueMicrotask(() => {
        const settings = normalizeFileManagerSettings(fileManagerStore.getState().settings);
        const favoritePaths = Array.isArray(fileManagerStore.getState().favoritePaths)
          ? fileManagerStore.getState().favoritePaths.filter((path): path is string => typeof path === 'string')
          : [];
        const favoriteIds = normalizeFavoriteIds(fileManagerStore.getState().favoriteIds);
        const privateIds = Array.isArray(fileManagerStore.getState().privateIds)
          ? fileManagerStore.getState().privateIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
          : [];
        fileManagerStore.setState({ settings, favoritePaths, favoriteIds, privateIds });
      });
    },
  },
);

export const useFileManagerStore = fileManagerStore;

// ---- Selectors ----

export const selectClipboardHasItems = memoSelector(
  (s: FileManagerState & FileManagerActions) => s.clipboardItems.length,
  (len) => len > 0,
);

registerStateAdapter('file_manager', (raw: Record<string, any>) => {
  const counts = FileSystem.getDestructiveOperationCounts();
  return {
    ...raw,
    deleted_count: counts.deleted,
    moved_count: counts.moved,
  };
});

// The adapter reads external filesystem counters, not fields in this store.
// Invalidate even for operations initiated outside File Manager's own UI.
const unsubscribeCounts = FileSystem.subscribeDestructiveOperationCounts(() => invalidateStateCache('file_manager'));
if (import.meta.hot) import.meta.hot.dispose(unsubscribeCounts);
