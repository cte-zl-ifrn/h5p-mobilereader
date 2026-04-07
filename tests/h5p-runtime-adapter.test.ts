import { H5PRuntimeAdapter } from '../src/adapters/h5p-runtime-adapter';
import { DiagnosticsService } from '../src/services/diagnostics';
import { ReaderState } from '../src/types';

describe('H5PRuntimeAdapter', () => {
  let adapter: H5PRuntimeAdapter;
  let diagnostics: DiagnosticsService;

  beforeEach(() => {
    diagnostics = new DiagnosticsService();
    adapter = new H5PRuntimeAdapter(diagnostics);
  });

  afterEach(() => {
    adapter.destroy();
  });

  describe('buildPlayerOptions', () => {
    it('sets h5pJsonPath correctly', () => {
      const opts = adapter.buildPlayerOptions({
        contentPath: '/data/content/content_abc',
        playerAssetsPath: '/assets/h5p',
        enableReporting: false,
        saveFreq: 30,
      });
      expect(opts.h5pJsonPath).toBe('/data/content/content_abc');
    });

    it('sets frameJs from playerAssetsPath', () => {
      const opts = adapter.buildPlayerOptions({
        contentPath: '/path',
        playerAssetsPath: '/assets/h5p',
        enableReporting: false,
        saveFreq: 30,
      });
      expect(opts.frameJs).toBe('/assets/h5p/frame.bundle.js');
      expect(opts.frameCss).toBe('/assets/h5p/styles/h5p.css');
    });

    it('omits contentUserData when no savedState', () => {
      const opts = adapter.buildPlayerOptions({
        contentPath: '/path',
        playerAssetsPath: '/assets',
        enableReporting: false,
        saveFreq: 30,
      });
      expect(opts.contentUserData).toBeUndefined();
    });

    it('omits contentUserData when savedState has no rawState', () => {
      const state: ReaderState = {
        contentId: 'c1',
        localUserId: 'local',
        lastAccessed: new Date(),
        progressPercent: 10,
        bookmarks: [],
        isFavorite: false,
      };
      const opts = adapter.buildPlayerOptions({
        contentPath: '/path',
        playerAssetsPath: '/assets',
        savedState: state,
        enableReporting: false,
        saveFreq: 30,
      });
      expect(opts.contentUserData).toBeUndefined();
    });

    it('includes contentUserData when savedState provided with rawState', () => {
      const state: ReaderState = {
        contentId: 'c1',
        localUserId: 'local',
        lastAccessed: new Date(),
        progressPercent: 50,
        rawState: '{"chapter":2}',
        bookmarks: [],
        isFavorite: false,
      };
      const opts = adapter.buildPlayerOptions({
        contentPath: '/path',
        playerAssetsPath: '/assets',
        savedState: state,
        enableReporting: false,
        saveFreq: 30,
      });
      expect(opts.contentUserData).toBeDefined();
      expect(opts.contentUserData?.[0].data).toBe('{"chapter":2}');
      expect(opts.contentUserData?.[0].preloaded).toBe(true);
      expect(opts.contentUserData?.[0].invalidate).toBe(false);
    });

    it('sets reportingIsEnabled correctly', () => {
      const opts = adapter.buildPlayerOptions({
        contentPath: '/path',
        playerAssetsPath: '/assets',
        enableReporting: true,
        saveFreq: false,
      });
      expect(opts.reportingIsEnabled).toBe(true);
      expect(opts.saveFreq).toBe(false);
    });

    it('sets saveFreq correctly', () => {
      const opts = adapter.buildPlayerOptions({
        contentPath: '/path',
        playerAssetsPath: '/assets',
        enableReporting: false,
        saveFreq: 60,
      });
      expect(opts.saveFreq).toBe(60);
    });
  });

  describe('captureCurrentState', () => {
    it('returns null in non-browser environment (no window.H5P)', () => {
      const state = adapter.captureCurrentState('content_abc');
      expect(state).toBeNull();
    });
  });

  describe('destroy', () => {
    it('can be called without errors', () => {
      expect(() => adapter.destroy()).not.toThrow();
    });

    it('can be called multiple times without errors', () => {
      adapter.destroy();
      expect(() => adapter.destroy()).not.toThrow();
    });
  });
});
