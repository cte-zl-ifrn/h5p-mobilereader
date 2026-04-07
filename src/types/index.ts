export interface LibraryItem {
  id: string;
  title: string;
  subtitle?: string;
  author?: string;
  primaryContentType: string;
  coverImage?: string;
  packageHash: string;
  importedAt: Date;
  lastAccessed?: Date;
  size: number;
  status: 'available' | 'broken' | 'processing';
  progress: number;
  isFavorite: boolean;
}

export interface ContentPackage {
  contentId: string;
  originalPackagePath: string;
  extractedPath: string;
  manifest: ContentManifest;
  detectedLibraries: DetectedLibrary[];
  compatiblePlayerVersion: string;
}

export interface ContentManifest {
  hash: string;
  importedAt: Date;
  h5pJson: H5PJson;
  warnings: string[];
}

export interface H5PJson {
  title: string;
  mainLibrary: string;
  language: string;
  license?: string;
  authors?: Array<{ name: string; role?: string }>;
  preloadedDependencies: Array<{ machineName: string; majorVersion: number; minorVersion: number }>;
}

export interface DetectedLibrary {
  machineName: string;
  majorVersion: number;
  minorVersion: number;
  present: boolean;
  path?: string;
}

export interface ReaderState {
  contentId: string;
  localUserId: string;
  lastAccessed: Date;
  progressPercent: number;
  rawState?: string;
  bookmarks: Bookmark[];
  isFavorite: boolean;
  location?: string;
}

export interface Bookmark {
  id: string;
  title: string;
  location: string;
  createdAt: Date;
}

export interface EventLog {
  id: string;
  timestamp: Date;
  eventType: 'opened' | 'closed' | 'completed' | 'progress' | 'error' | 'xapi';
  contentId: string;
  payload?: Record<string, unknown>;
  syncStatus: 'pending' | 'synced' | 'failed';
}

export interface SyncQueueItem {
  id: string;
  contentId: string;
  type: 'state' | 'event' | 'completion';
  payload: Record<string, unknown>;
  createdAt: Date;
  attempts: number;
  lastAttempt?: Date;
}

export interface ImportResult {
  contentId: string;
  hash: string;
  status: 'success' | 'failed' | 'warnings';
  warnings: string[];
  detectedLibraries: DetectedLibrary[];
  primaryContentType: string;
}

export interface ValidationError {
  code: string;
  message: string;
  missingDependency?: string;
}

export interface OpenContentRequest {
  contentId: string;
  readerMode?: 'normal' | 'fullscreen';
  restoreState: boolean;
}

export interface StateSnapshot {
  contentId: string;
  userIdLocal: string;
  savedAt: Date;
  dataType: string;
  previousState?: string;
  progress: number;
  location?: string;
}

export interface PlayerOptions {
  h5pJsonPath: string;
  frameJs: string;
  frameCss: string;
  contentUserData?: Array<{ data: string; preloaded: boolean; invalidate: boolean }>;
  saveFreq?: number | false;
  reportingIsEnabled?: boolean;
}
