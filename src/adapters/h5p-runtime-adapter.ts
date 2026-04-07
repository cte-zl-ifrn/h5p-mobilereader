import { PlayerOptions, ReaderState, StateSnapshot } from '../types';
import { DiagnosticsService } from '../services/diagnostics';

export interface H5PAdapterOptions {
  container: HTMLElement;
  contentPath: string;
  playerAssetsPath: string;
  savedState?: ReaderState;
  enableReporting?: boolean;
  enableFullscreen?: boolean;
  saveFreq?: number | false;
  onXapi?: (event: unknown) => void;
  onStateChange?: (snapshot: StateSnapshot) => void;
  onError?: (error: Error) => void;
}

export class H5PRuntimeAdapter {
  private diagnostics: DiagnosticsService;
  private currentContentId: string | null = null;
  private saveInterval: ReturnType<typeof setInterval> | null = null;

  constructor(diagnostics: DiagnosticsService) {
    this.diagnostics = diagnostics;
  }

  async openContent(options: H5PAdapterOptions): Promise<void> {
    const {
      container,
      contentPath,
      playerAssetsPath,
      savedState,
      enableReporting = false,
      enableFullscreen = false,
      saveFreq = 30,
      onXapi,
      onStateChange,
      onError,
    } = options;

    try {
      this.diagnostics.info('Opening H5P content', { contentPath });

      const playerOptions = this.buildPlayerOptions({
        contentPath,
        playerAssetsPath,
        savedState,
        enableReporting,
        saveFreq,
      });

      const { H5PStandalone } = await import('h5p-standalone');
      await H5PStandalone(container, playerOptions);

      this.diagnostics.info('H5P player initialized successfully', { contentPath });

      if (onXapi && typeof window !== 'undefined') {
        this.setupXAPIListener(onXapi);
      }

      if (saveFreq && onStateChange) {
        this.setupAutoSave(saveFreq, onStateChange, savedState?.contentId ?? 'unknown');
      }

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.diagnostics.error('Failed to open H5P content', { error: err.message, contentPath });
      onError?.(err);
      throw err;
    }
  }

  buildPlayerOptions(params: {
    contentPath: string;
    playerAssetsPath: string;
    savedState?: ReaderState;
    enableReporting: boolean;
    saveFreq: number | false;
  }): PlayerOptions {
    const { contentPath, playerAssetsPath, savedState, enableReporting, saveFreq } = params;

    const opts: PlayerOptions = {
      h5pJsonPath: contentPath,
      frameJs: `${playerAssetsPath}/frame.bundle.js`,
      frameCss: `${playerAssetsPath}/styles/h5p.css`,
      reportingIsEnabled: enableReporting,
      saveFreq,
    };

    if (savedState?.rawState) {
      try {
        opts.contentUserData = [
          {
            data: savedState.rawState,
            preloaded: true,
            invalidate: false,
          },
        ];
      } catch {
        this.diagnostics.warn('Failed to parse saved state, starting fresh');
      }
    }

    return opts;
  }

  private setupXAPIListener(callback: (event: unknown) => void): void {
    if (typeof window === 'undefined') return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const H5P = (window as any).H5P;
    if (H5P?.externalDispatcher) {
      H5P.externalDispatcher.on('xAPI', (event: unknown) => {
        this.diagnostics.debug('xAPI event received', { event: JSON.stringify(event) });
        callback(event);
      });
    }
  }

  private setupAutoSave(
    intervalSeconds: number,
    onStateChange: (snapshot: StateSnapshot) => void,
    contentId: string
  ): void {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
    }

    this.saveInterval = setInterval(() => {
      const state = this.captureCurrentState(contentId);
      if (state) {
        onStateChange(state);
      }
    }, intervalSeconds * 1000);
  }

  captureCurrentState(contentId: string): StateSnapshot | null {
    if (typeof window === 'undefined') return null;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const H5P = (window as any).H5P;
      if (!H5P?.instances?.[0]) return null;

      const instance = H5P.instances[0];
      const rawState = JSON.stringify(instance.getCurrentState?.() ?? {});

      return {
        contentId,
        userIdLocal: 'local',
        savedAt: new Date(),
        dataType: 'state',
        previousState: rawState,
        progress: this.estimateProgress(instance),
        location: instance.getCurrentChapter?.()?.toString(),
      };
    } catch {
      return null;
    }
  }

  private estimateProgress(instance: unknown): number {
    if (!instance || typeof instance !== 'object') return 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inst = instance as any;
    if (typeof inst.getProgress === 'function') {
      return Math.round(inst.getProgress() * 100);
    }
    return 0;
  }

  destroy(): void {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = null;
    }
    this.currentContentId = null;
  }
}
