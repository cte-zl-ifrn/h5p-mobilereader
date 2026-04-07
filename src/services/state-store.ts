import { ReaderState, EventLog, SyncQueueItem, StateSnapshot, LibraryItem, ContentPackage } from '../types';

export interface IStateStore {
  saveReaderState(state: ReaderState): Promise<void>;
  getReaderState(contentId: string, userId: string): Promise<ReaderState | null>;
  saveLibraryItem(item: LibraryItem): Promise<void>;
  getLibraryItems(): Promise<LibraryItem[]>;
  getLibraryItem(id: string): Promise<LibraryItem | null>;
  deleteLibraryItem(id: string): Promise<void>;
  saveContentPackage(pkg: ContentPackage): Promise<void>;
  getContentPackage(contentId: string): Promise<ContentPackage | null>;
  logEvent(event: EventLog): Promise<void>;
  getEvents(contentId: string): Promise<EventLog[]>;
  addToSyncQueue(item: SyncQueueItem): Promise<void>;
  getSyncQueue(): Promise<SyncQueueItem[]>;
  removeSyncQueueItem(id: string): Promise<void>;
  applyStateSnapshot(snapshot: StateSnapshot): Promise<void>;
}

export class InMemoryStateStore implements IStateStore {
  private libraryItems: Map<string, LibraryItem> = new Map();
  private contentPackages: Map<string, ContentPackage> = new Map();
  private readerStates: Map<string, ReaderState> = new Map();
  private eventLogs: EventLog[] = [];
  private syncQueue: Map<string, SyncQueueItem> = new Map();

  async saveLibraryItem(item: LibraryItem): Promise<void> {
    this.libraryItems.set(item.id, { ...item });
  }

  async getLibraryItems(): Promise<LibraryItem[]> {
    return Array.from(this.libraryItems.values()).sort((a, b) => {
      const aAccessed = a.lastAccessed?.getTime();
      const bAccessed = b.lastAccessed?.getTime();
      if (aAccessed !== undefined && bAccessed !== undefined) return bAccessed - aAccessed;
      if (aAccessed !== undefined) return -1;
      if (bAccessed !== undefined) return 1;
      return b.importedAt.getTime() - a.importedAt.getTime();
    });
  }

  async getLibraryItem(id: string): Promise<LibraryItem | null> {
    return this.libraryItems.get(id) ?? null;
  }

  async deleteLibraryItem(id: string): Promise<void> {
    this.libraryItems.delete(id);
    this.contentPackages.delete(id);
    this.readerStates.delete(this.stateKey(id, 'local'));
  }

  async saveContentPackage(pkg: ContentPackage): Promise<void> {
    this.contentPackages.set(pkg.contentId, { ...pkg });
  }

  async getContentPackage(contentId: string): Promise<ContentPackage | null> {
    return this.contentPackages.get(contentId) ?? null;
  }

  async saveReaderState(state: ReaderState): Promise<void> {
    const key = this.stateKey(state.contentId, state.localUserId);
    this.readerStates.set(key, { ...state });
  }

  async getReaderState(contentId: string, userId: string): Promise<ReaderState | null> {
    const key = this.stateKey(contentId, userId);
    return this.readerStates.get(key) ?? null;
  }

  async logEvent(event: EventLog): Promise<void> {
    this.eventLogs.push({ ...event });
  }

  async getEvents(contentId: string): Promise<EventLog[]> {
    return this.eventLogs.filter(e => e.contentId === contentId);
  }

  async addToSyncQueue(item: SyncQueueItem): Promise<void> {
    this.syncQueue.set(item.id, { ...item });
  }

  async getSyncQueue(): Promise<SyncQueueItem[]> {
    return Array.from(this.syncQueue.values());
  }

  async removeSyncQueueItem(id: string): Promise<void> {
    this.syncQueue.delete(id);
  }

  async applyStateSnapshot(snapshot: StateSnapshot): Promise<void> {
    const existing = await this.getReaderState(snapshot.contentId, snapshot.userIdLocal);
    const updatedState: ReaderState = {
      contentId: snapshot.contentId,
      localUserId: snapshot.userIdLocal,
      lastAccessed: snapshot.savedAt,
      progressPercent: snapshot.progress,
      rawState: snapshot.previousState,
      bookmarks: existing?.bookmarks ?? [],
      isFavorite: existing?.isFavorite ?? false,
      location: snapshot.location,
    };
    await this.saveReaderState(updatedState);
  }

  private stateKey(contentId: string, userId: string): string {
    return `${contentId}:${userId}`;
  }

  clear(): void {
    this.libraryItems.clear();
    this.contentPackages.clear();
    this.readerStates.clear();
    this.eventLogs = [];
    this.syncQueue.clear();
  }
}
