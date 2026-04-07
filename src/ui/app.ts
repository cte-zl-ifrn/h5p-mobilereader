import { DiagnosticsService } from '../services/diagnostics';
import { ContentService } from '../services/content-service';
import { MetadataIndexer } from '../services/metadata-indexer';
import { InMemoryStateStore } from '../services/state-store';
import { H5PRuntimeAdapter } from '../adapters/h5p-runtime-adapter';
import { LibraryItem } from '../types';
import { escapeHtml } from './library-view';

export class App {
  private diagnostics: DiagnosticsService;
  private contentService: ContentService;
  private metadataIndexer: MetadataIndexer;
  private stateStore: InMemoryStateStore;
  private h5pAdapter: H5PRuntimeAdapter;
  private currentView: 'library' | 'reader' | 'diagnostics' = 'library';

  constructor() {
    this.diagnostics = new DiagnosticsService();
    this.contentService = new ContentService();
    this.metadataIndexer = new MetadataIndexer();
    this.stateStore = new InMemoryStateStore();
    this.h5pAdapter = new H5PRuntimeAdapter(this.diagnostics);
  }

  async init(): Promise<void> {
    this.diagnostics.info('H5P MobileReader initializing');
    this.renderShell();
    await this.renderLibraryView();
  }

  private renderShell(): void {
    const appEl = document.getElementById('app');
    if (!appEl) return;

    appEl.innerHTML = `
      <div class="app-shell">
        <header class="app-header">
          <h1>H5P Reader</h1>
          <nav class="app-nav">
            <button id="nav-library" class="nav-btn active">Library</button>
            <button id="nav-diagnostics" class="nav-btn">Diagnostics</button>
          </nav>
        </header>
        <main id="main-content" class="main-content"></main>
      </div>
    `;

    document.getElementById('nav-library')?.addEventListener('click', () => this.renderLibraryView());
    document.getElementById('nav-diagnostics')?.addEventListener('click', () => this.renderDiagnosticsView());
  }

  async renderLibraryView(): Promise<void> {
    this.currentView = 'library';
    const main = document.getElementById('main-content');
    if (!main) return;

    const items = await this.stateStore.getLibraryItems();

    main.innerHTML = `
      <div class="library-view">
        <div class="library-toolbar">
          <button id="btn-import" class="btn-primary">Import H5P</button>
          <input type="file" id="file-input" accept=".h5p" style="display:none">
        </div>
        <div id="library-list" class="library-list">
          ${items.length === 0 ? '<p class="empty-state">No content imported yet. Click "Import H5P" to get started.</p>' : ''}
          ${items.map(item => this.renderLibraryItemCard(item)).join('')}
        </div>
      </div>
    `;

    document.getElementById('btn-import')?.addEventListener('click', () => {
      document.getElementById('file-input')?.click();
    });

    document.getElementById('file-input')?.addEventListener('change', async (e) => {
      const input = e.target as HTMLInputElement;
      const file = input.files?.[0];
      if (file) await this.importFile(file);
    });

    items.forEach(item => {
      document.getElementById(`open-${item.id}`)?.addEventListener('click', () => this.openContent(item.id));
      document.getElementById(`delete-${item.id}`)?.addEventListener('click', () => this.deleteContent(item.id));
    });
  }

  private renderLibraryItemCard(item: LibraryItem): string {
    const statusClass = item.status === 'available' ? 'status-ok' : item.status === 'broken' ? 'status-broken' : 'status-processing';
    const progressBar = item.progress > 0 ? `<div class="progress-bar"><div class="progress-fill" style="width:${item.progress}%"></div></div>` : '';
    return `
      <div class="library-card ${statusClass}">
        <div class="card-info">
          <h3 class="card-title">${escapeHtml(item.title)}</h3>
          <p class="card-type">${escapeHtml(item.primaryContentType)}</p>
          ${item.author ? `<p class="card-author">by ${escapeHtml(item.author)}</p>` : ''}
          <p class="card-date">Imported: ${item.importedAt.toLocaleDateString()}</p>
          ${progressBar}
          ${item.status === 'broken' ? '<p class="card-warning">⚠ Some libraries may be missing</p>' : ''}
        </div>
        <div class="card-actions">
          ${item.status === 'available' ? `<button id="open-${item.id}" class="btn-primary">Open</button>` : '<button disabled class="btn-disabled">Unavailable</button>'}
          <button id="delete-${item.id}" class="btn-danger">Delete</button>
        </div>
      </div>
    `;
  }

  async openContent(contentId: string): Promise<void> {
    this.currentView = 'reader';
    const main = document.getElementById('main-content');
    if (!main) return;

    const pkg = await this.stateStore.getContentPackage(contentId);
    const savedState = await this.stateStore.getReaderState(contentId, 'local');

    main.innerHTML = `
      <div class="reader-view">
        <div class="reader-toolbar">
          <button id="btn-back" class="btn-secondary">← Back</button>
          <span id="reader-title" class="reader-title"></span>
          <button id="btn-reader-diagnostics" class="btn-secondary">Diagnostics</button>
        </div>
        <div id="h5p-container" class="h5p-container"></div>
      </div>
    `;

    document.getElementById('btn-back')?.addEventListener('click', () => this.renderLibraryView());
    document.getElementById('btn-reader-diagnostics')?.addEventListener('click', () => this.renderDiagnosticsView(contentId));

    const item = await this.stateStore.getLibraryItem(contentId);
    const titleEl = document.getElementById('reader-title');
    if (titleEl && item) titleEl.textContent = item.title;

    if (item) {
      await this.stateStore.saveLibraryItem({ ...item, lastAccessed: new Date() });
    }

    const container = document.getElementById('h5p-container');
    if (!container || !pkg) return;

    await this.h5pAdapter.openContent({
      container,
      contentPath: pkg.extractedPath,
      playerAssetsPath: '/assets/h5p',
      savedState: savedState ?? undefined,
      enableReporting: this.metadataIndexer.isPriorityContentType(pkg.manifest.h5pJson.mainLibrary),
      enableFullscreen: true,
      saveFreq: 30,
      onXapi: (event) => {
        this.diagnostics.debug('xAPI event', { event }, contentId);
      },
      onStateChange: async (snapshot) => {
        await this.stateStore.applyStateSnapshot(snapshot);
      },
      onError: (error) => {
        this.diagnostics.error('Player error', { message: error.message }, contentId);
      },
    });
  }

  async importFile(file: File): Promise<void> {
    const main = document.getElementById('main-content');
    if (!main) return;

    const statusEl = document.createElement('div');
    statusEl.className = 'import-status';
    statusEl.textContent = `Importing ${file.name}...`;
    main.prepend(statusEl);

    try {
      const buffer = await file.arrayBuffer();
      const result = await this.contentService.importPackage(file.name, buffer);

      if (result.status === 'failed') {
        statusEl.textContent = `Failed to import: ${result.warnings.join(', ')}`;
        statusEl.className = 'import-status error';
        return;
      }

      const sizeValidation = this.contentService.validatePackageSize(buffer);
      if (sizeValidation) {
        statusEl.textContent = sizeValidation.message;
        statusEl.className = 'import-status error';
        return;
      }

      const h5pJson = {
        title: file.name.replace('.h5p', ''),
        mainLibrary: result.primaryContentType,
        language: 'en',
        preloadedDependencies: [] as Array<{ machineName: string; majorVersion: number; minorVersion: number }>,
      };

      const libraryItem = this.metadataIndexer.buildLibraryItem(
        result.contentId, h5pJson, result.hash, buffer.byteLength, result.warnings
      );
      await this.stateStore.saveLibraryItem(libraryItem);

      const contentPkg = this.metadataIndexer.buildContentPackage(
        result.contentId, file.name, `./data/content/${result.contentId}`,
        h5pJson, result.hash, result.warnings, result.detectedLibraries
      );
      await this.stateStore.saveContentPackage(contentPkg);

      this.diagnostics.info('Content imported successfully', { contentId: result.contentId, title: file.name });
      statusEl.textContent = `Imported: ${file.name}`;
      statusEl.className = 'import-status success';

      await this.renderLibraryView();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      statusEl.textContent = `Error: ${msg}`;
      statusEl.className = 'import-status error';
      this.diagnostics.error('Import failed', { error: msg });
    }

    setTimeout(() => statusEl.remove(), 3000);
  }

  async deleteContent(contentId: string): Promise<void> {
    const state = await this.stateStore.getReaderState(contentId, 'local');
    if (state && state.progressPercent > 0) {
      if (!confirm('This content has unsaved progress. Delete anyway?')) return;
    }
    await this.stateStore.deleteLibraryItem(contentId);
    this.diagnostics.info('Content deleted', { contentId });
    await this.renderLibraryView();
  }

  renderDiagnosticsView(contentId?: string): void {
    this.currentView = 'diagnostics';
    const main = document.getElementById('main-content');
    if (!main) return;

    const entries = contentId
      ? this.diagnostics.getEntriesForContent(contentId)
      : this.diagnostics.getRecentErrors();

    main.innerHTML = `
      <div class="diagnostics-view">
        <div class="diagnostics-toolbar">
          <button id="btn-back-diag" class="btn-secondary">← Back</button>
          <button id="btn-export-logs" class="btn-secondary">Export Logs</button>
          <button id="btn-clear-logs" class="btn-danger">Clear Logs</button>
        </div>
        <h2>Diagnostics${contentId ? ` (${contentId})` : ' (Recent Errors)'}</h2>
        <div class="log-entries">
          ${entries.length === 0 ? '<p>No log entries.</p>' : entries.map(e => `
            <div class="log-entry log-${e.level}">
              <span class="log-time">${e.timestamp.toISOString()}</span>
              <span class="log-level">[${e.level.toUpperCase()}]</span>
              <span class="log-msg">${escapeHtml(e.message)}</span>
              ${e.context ? `<pre class="log-context">${escapeHtml(JSON.stringify(e.context, null, 2))}</pre>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;

    document.getElementById('btn-back-diag')?.addEventListener('click', () => this.renderLibraryView());
    document.getElementById('btn-export-logs')?.addEventListener('click', () => {
      const text = this.diagnostics.exportAsText();
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'h5p-reader-logs.txt';
      a.click();
      URL.revokeObjectURL(url);
    });

    document.getElementById('btn-clear-logs')?.addEventListener('click', () => {
      this.diagnostics.clear();
      this.renderDiagnosticsView(contentId);
    });
  }

}
