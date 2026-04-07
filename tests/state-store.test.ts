import { InMemoryStateStore } from '../src/services/state-store';
import { LibraryItem, ReaderState, EventLog, SyncQueueItem, StateSnapshot } from '../src/types';

function makeLibraryItem(id: string, overrides: Partial<LibraryItem> = {}): LibraryItem {
  return {
    id,
    title: `Title ${id}`,
    primaryContentType: 'H5P.InteractiveBook',
    packageHash: `hash_${id}`,
    importedAt: new Date('2024-01-01'),
    size: 1024,
    status: 'available',
    progress: 0,
    isFavorite: false,
    ...overrides,
  };
}

function makeReaderState(contentId: string, userId = 'local', overrides: Partial<ReaderState> = {}): ReaderState {
  return {
    contentId,
    localUserId: userId,
    lastAccessed: new Date(),
    progressPercent: 0,
    bookmarks: [],
    isFavorite: false,
    ...overrides,
  };
}

describe('InMemoryStateStore', () => {
  let store: InMemoryStateStore;

  beforeEach(() => {
    store = new InMemoryStateStore();
  });

  describe('LibraryItem operations', () => {
    it('saveLibraryItem and getLibraryItem round-trip', async () => {
      const item = makeLibraryItem('c1');
      await store.saveLibraryItem(item);
      const retrieved = await store.getLibraryItem('c1');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe('c1');
      expect(retrieved?.title).toBe('Title c1');
    });

    it('returns null for non-existent item', async () => {
      expect(await store.getLibraryItem('nonexistent')).toBeNull();
    });

    it('getLibraryItems returns items sorted by lastAccessed desc', async () => {
      const item1 = makeLibraryItem('c1', { importedAt: new Date('2024-01-01'), lastAccessed: new Date('2024-01-03') });
      const item2 = makeLibraryItem('c2', { importedAt: new Date('2024-01-02'), lastAccessed: new Date('2024-01-05') });
      const item3 = makeLibraryItem('c3', { importedAt: new Date('2024-01-04') });
      await store.saveLibraryItem(item1);
      await store.saveLibraryItem(item2);
      await store.saveLibraryItem(item3);
      const items = await store.getLibraryItems();
      expect(items[0].id).toBe('c2');
      expect(items[1].id).toBe('c1');
      expect(items[2].id).toBe('c3');
    });

    it('deleteLibraryItem removes item', async () => {
      await store.saveLibraryItem(makeLibraryItem('c1'));
      await store.deleteLibraryItem('c1');
      expect(await store.getLibraryItem('c1')).toBeNull();
    });

    it('updateLibraryItem updates existing item', async () => {
      await store.saveLibraryItem(makeLibraryItem('c1', { progress: 0 }));
      await store.saveLibraryItem(makeLibraryItem('c1', { progress: 50 }));
      const item = await store.getLibraryItem('c1');
      expect(item?.progress).toBe(50);
    });
  });

  describe('ReaderState operations', () => {
    it('saveReaderState and getReaderState round-trip', async () => {
      const state = makeReaderState('c1', 'local', { progressPercent: 42 });
      await store.saveReaderState(state);
      const retrieved = await store.getReaderState('c1', 'local');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.progressPercent).toBe(42);
    });

    it('returns null for non-existent state', async () => {
      expect(await store.getReaderState('c1', 'local')).toBeNull();
    });

    it('different userId creates different states', async () => {
      await store.saveReaderState(makeReaderState('c1', 'user1', { progressPercent: 10 }));
      await store.saveReaderState(makeReaderState('c1', 'user2', { progressPercent: 20 }));
      const s1 = await store.getReaderState('c1', 'user1');
      const s2 = await store.getReaderState('c1', 'user2');
      expect(s1?.progressPercent).toBe(10);
      expect(s2?.progressPercent).toBe(20);
    });
  });

  describe('applyStateSnapshot', () => {
    it('creates reader state from snapshot', async () => {
      const snapshot: StateSnapshot = {
        contentId: 'c1',
        userIdLocal: 'local',
        savedAt: new Date('2024-06-01'),
        dataType: 'state',
        previousState: '{"chapter":3}',
        progress: 75,
        location: 'chapter-3',
      };
      await store.applyStateSnapshot(snapshot);
      const state = await store.getReaderState('c1', 'local');
      expect(state).not.toBeNull();
      expect(state?.progressPercent).toBe(75);
      expect(state?.rawState).toBe('{"chapter":3}');
      expect(state?.location).toBe('chapter-3');
    });

    it('preserves existing bookmarks when applying snapshot', async () => {
      const existing = makeReaderState('c1', 'local', {
        bookmarks: [{ id: 'bk1', title: 'Bookmark', location: 'ch1', createdAt: new Date() }],
      });
      await store.saveReaderState(existing);

      const snapshot: StateSnapshot = {
        contentId: 'c1',
        userIdLocal: 'local',
        savedAt: new Date(),
        dataType: 'state',
        progress: 50,
      };
      await store.applyStateSnapshot(snapshot);
      const state = await store.getReaderState('c1', 'local');
      expect(state?.bookmarks).toHaveLength(1);
    });
  });

  describe('EventLog operations', () => {
    it('logEvent and getEvents filter by contentId', async () => {
      const event1: EventLog = {
        id: 'e1',
        timestamp: new Date(),
        eventType: 'opened',
        contentId: 'c1',
        syncStatus: 'pending',
      };
      const event2: EventLog = {
        id: 'e2',
        timestamp: new Date(),
        eventType: 'completed',
        contentId: 'c2',
        syncStatus: 'pending',
      };
      const event3: EventLog = {
        id: 'e3',
        timestamp: new Date(),
        eventType: 'progress',
        contentId: 'c1',
        syncStatus: 'pending',
      };
      await store.logEvent(event1);
      await store.logEvent(event2);
      await store.logEvent(event3);
      const c1Events = await store.getEvents('c1');
      expect(c1Events).toHaveLength(2);
      expect(c1Events.map(e => e.id)).toContain('e1');
      expect(c1Events.map(e => e.id)).toContain('e3');
      const c2Events = await store.getEvents('c2');
      expect(c2Events).toHaveLength(1);
    });

    it('returns empty array for content with no events', async () => {
      expect(await store.getEvents('nonexistent')).toEqual([]);
    });
  });

  describe('SyncQueue operations', () => {
    it('addToSyncQueue and getSyncQueue', async () => {
      const item: SyncQueueItem = {
        id: 'sq1',
        contentId: 'c1',
        type: 'state',
        payload: { data: 'test' },
        createdAt: new Date(),
        attempts: 0,
      };
      await store.addToSyncQueue(item);
      const queue = await store.getSyncQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0].id).toBe('sq1');
    });

    it('removeSyncQueueItem removes item', async () => {
      const item: SyncQueueItem = {
        id: 'sq1',
        contentId: 'c1',
        type: 'event',
        payload: {},
        createdAt: new Date(),
        attempts: 0,
      };
      await store.addToSyncQueue(item);
      await store.removeSyncQueueItem('sq1');
      const queue = await store.getSyncQueue();
      expect(queue).toHaveLength(0);
    });

    it('returns empty queue initially', async () => {
      expect(await store.getSyncQueue()).toEqual([]);
    });
  });

  describe('ContentPackage operations', () => {
    it('saveContentPackage and getContentPackage round-trip', async () => {
      const pkg = {
        contentId: 'c1',
        originalPackagePath: '/orig',
        extractedPath: '/extracted',
        manifest: {
          hash: 'abc',
          importedAt: new Date(),
          h5pJson: { title: 'T', mainLibrary: 'H5P.Test', language: 'en', preloadedDependencies: [] },
          warnings: [],
        },
        detectedLibraries: [],
        compatiblePlayerVersion: '3.8.2',
      };
      await store.saveContentPackage(pkg);
      const retrieved = await store.getContentPackage('c1');
      expect(retrieved?.contentId).toBe('c1');
      expect(retrieved?.extractedPath).toBe('/extracted');
    });

    it('returns null for non-existent content package', async () => {
      expect(await store.getContentPackage('nonexistent')).toBeNull();
    });
  });

  describe('clear', () => {
    it('clears all data', async () => {
      await store.saveLibraryItem(makeLibraryItem('c1'));
      await store.saveReaderState(makeReaderState('c1'));
      store.clear();
      expect(await store.getLibraryItems()).toEqual([]);
      expect(await store.getReaderState('c1', 'local')).toBeNull();
    });
  });
});
