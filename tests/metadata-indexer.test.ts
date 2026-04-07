import { MetadataIndexer } from '../src/services/metadata-indexer';
import { DetectedLibrary, H5PJson } from '../src/types';

describe('MetadataIndexer', () => {
  let indexer: MetadataIndexer;

  beforeEach(() => {
    indexer = new MetadataIndexer();
  });

  describe('parseH5PJson', () => {
    it('parses valid h5p.json', () => {
      const json = JSON.stringify({
        title: 'My Course',
        mainLibrary: 'H5P.InteractiveBook',
        language: 'pt-BR',
        license: 'CC BY',
        authors: [{ name: 'Alice', role: 'Author' }],
        preloadedDependencies: [{ machineName: 'H5P.SomeLib', majorVersion: 1, minorVersion: 0 }],
      });
      const result = indexer.parseH5PJson(json);
      expect(result.title).toBe('My Course');
      expect(result.mainLibrary).toBe('H5P.InteractiveBook');
      expect(result.language).toBe('pt-BR');
      expect(result.license).toBe('CC BY');
      expect(result.authors?.[0].name).toBe('Alice');
      expect(result.preloadedDependencies).toHaveLength(1);
    });

    it('handles missing fields with defaults', () => {
      const json = JSON.stringify({});
      const result = indexer.parseH5PJson(json);
      expect(result.title).toBe('Untitled');
      expect(result.mainLibrary).toBe('unknown');
      expect(result.language).toBe('en');
      expect(result.preloadedDependencies).toEqual([]);
    });

    it('throws for invalid JSON', () => {
      expect(() => indexer.parseH5PJson('not json')).toThrow();
    });
  });

  describe('buildLibraryItem', () => {
    const h5pJson: H5PJson = {
      title: 'Test Title',
      mainLibrary: 'H5P.InteractiveBook',
      language: 'en',
      authors: [{ name: 'Bob' }],
      preloadedDependencies: [],
    };

    it('creates correct LibraryItem', () => {
      const item = indexer.buildLibraryItem('content_abc', h5pJson, 'hash123', 1024, []);
      expect(item.id).toBe('content_abc');
      expect(item.title).toBe('Test Title');
      expect(item.primaryContentType).toBe('H5P.InteractiveBook');
      expect(item.packageHash).toBe('hash123');
      expect(item.size).toBe(1024);
      expect(item.status).toBe('available');
      expect(item.progress).toBe(0);
      expect(item.isFavorite).toBe(false);
      expect(item.author).toBe('Bob');
    });

    it('sets status to broken when warnings exist', () => {
      const item = indexer.buildLibraryItem('content_abc', h5pJson, 'hash123', 1024, ['some warning']);
      expect(item.status).toBe('broken');
    });

    it('sets author to undefined when no authors', () => {
      const noAuthorJson = { ...h5pJson, authors: undefined };
      const item = indexer.buildLibraryItem('content_abc', noAuthorJson, 'hash123', 1024, []);
      expect(item.author).toBeUndefined();
    });
  });

  describe('extractTitle', () => {
    it('returns title from h5pJson', () => {
      const h5pJson: H5PJson = { title: 'My Title', mainLibrary: 'H5P.Test', language: 'en', preloadedDependencies: [] };
      expect(indexer.extractTitle(h5pJson)).toBe('My Title');
    });

    it('returns Untitled for empty title', () => {
      const h5pJson = { title: '', mainLibrary: 'H5P.Test', language: 'en', preloadedDependencies: [] };
      expect(indexer.extractTitle(h5pJson)).toBe('Untitled');
    });
  });

  describe('extractAuthor', () => {
    it('returns first author name', () => {
      const h5pJson: H5PJson = {
        title: 'T',
        mainLibrary: 'H5P.Test',
        language: 'en',
        authors: [{ name: 'Alice' }, { name: 'Bob' }],
        preloadedDependencies: [],
      };
      expect(indexer.extractAuthor(h5pJson)).toBe('Alice');
    });

    it('returns undefined when no authors', () => {
      const h5pJson: H5PJson = { title: 'T', mainLibrary: 'H5P.Test', language: 'en', preloadedDependencies: [] };
      expect(indexer.extractAuthor(h5pJson)).toBeUndefined();
    });

    it('returns undefined for empty authors array', () => {
      const h5pJson: H5PJson = { title: 'T', mainLibrary: 'H5P.Test', language: 'en', authors: [], preloadedDependencies: [] };
      expect(indexer.extractAuthor(h5pJson)).toBeUndefined();
    });
  });

  describe('isPriorityContentType', () => {
    it('returns true for H5P.InteractiveBook', () => {
      expect(indexer.isPriorityContentType('H5P.InteractiveBook')).toBe(true);
    });

    it('returns true for H5P.CoursePresentation', () => {
      expect(indexer.isPriorityContentType('H5P.CoursePresentation')).toBe(true);
    });

    it('returns true for H5P.QuestionSet', () => {
      expect(indexer.isPriorityContentType('H5P.QuestionSet')).toBe(true);
    });

    it('returns true for H5P.InteractiveVideo', () => {
      expect(indexer.isPriorityContentType('H5P.InteractiveVideo')).toBe(true);
    });

    it('returns false for unknown types', () => {
      expect(indexer.isPriorityContentType('H5P.Unknown')).toBe(false);
      expect(indexer.isPriorityContentType('')).toBe(false);
    });
  });

  describe('getMissingLibraries', () => {
    it('filters absent libraries', () => {
      const libs: DetectedLibrary[] = [
        { machineName: 'H5P.A', majorVersion: 1, minorVersion: 0, present: true },
        { machineName: 'H5P.B', majorVersion: 1, minorVersion: 0, present: false },
        { machineName: 'H5P.C', majorVersion: 2, minorVersion: 1, present: false },
      ];
      const missing = indexer.getMissingLibraries(libs);
      expect(missing).toHaveLength(2);
      expect(missing.map(l => l.machineName)).toEqual(['H5P.B', 'H5P.C']);
    });

    it('returns empty array when all libraries present', () => {
      const libs: DetectedLibrary[] = [
        { machineName: 'H5P.A', majorVersion: 1, minorVersion: 0, present: true },
      ];
      expect(indexer.getMissingLibraries(libs)).toHaveLength(0);
    });
  });

  describe('formatLibraryName', () => {
    it('formats correctly', () => {
      const lib: DetectedLibrary = { machineName: 'H5P.InteractiveBook', majorVersion: 1, minorVersion: 5, present: true };
      expect(indexer.formatLibraryName(lib)).toBe('H5P.InteractiveBook-1.5');
    });
  });

  describe('buildContentPackage', () => {
    it('creates content package with correct fields', () => {
      const h5pJson: H5PJson = { title: 'Test', mainLibrary: 'H5P.Test', language: 'en', preloadedDependencies: [] };
      const pkg = indexer.buildContentPackage('cid', '/original', '/extracted', h5pJson, 'hash', [], []);
      expect(pkg.contentId).toBe('cid');
      expect(pkg.originalPackagePath).toBe('/original');
      expect(pkg.extractedPath).toBe('/extracted');
      expect(pkg.manifest.hash).toBe('hash');
      expect(pkg.compatiblePlayerVersion).toBe('3.8.2');
    });
  });
});
