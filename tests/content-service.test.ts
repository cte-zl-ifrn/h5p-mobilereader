import { ContentService } from '../src/services/content-service';
import JSZip from 'jszip';

async function createValidH5PZip(includeContent = true, includeDependencies = false): Promise<ArrayBuffer> {
  const zip = new JSZip();
  const h5pJson = {
    title: 'Test Content',
    mainLibrary: 'H5P.InteractiveBook',
    language: 'en',
    preloadedDependencies: includeDependencies
      ? [{ machineName: 'H5P.SomeLib', majorVersion: 1, minorVersion: 0 }]
      : [],
  };
  zip.file('h5p.json', JSON.stringify(h5pJson));
  if (includeContent) {
    zip.file('content/content.json', JSON.stringify({ chapters: [] }));
  }
  const buffer = await zip.generateAsync({ type: 'arraybuffer' });
  return buffer;
}

describe('ContentService', () => {
  let service: ContentService;

  beforeEach(() => {
    service = new ContentService('./test-data/content');
  });

  describe('calculateHash', () => {
    it('returns consistent hash for same input', async () => {
      const buffer = new TextEncoder().encode('hello world').buffer;
      const hash1 = await service.calculateHash(buffer);
      const hash2 = await service.calculateHash(buffer);
      expect(hash1).toBe(hash2);
    });

    it('returns different hashes for different inputs', async () => {
      const buf1 = new TextEncoder().encode('hello').buffer;
      const buf2 = new TextEncoder().encode('world').buffer;
      expect(await service.calculateHash(buf1)).not.toBe(await service.calculateHash(buf2));
    });

    it('returns a hex string of length 64', async () => {
      const buffer = new TextEncoder().encode('test').buffer;
      const hash = await service.calculateHash(buffer);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('generateContentId', () => {
    it('returns string starting with content_', () => {
      const id = service.generateContentId('abc123def456789012345678');
      expect(id).toMatch(/^content_/);
    });

    it('includes first 16 chars of hash', () => {
      const hash = 'abcdef1234567890abcdef';
      const id = service.generateContentId(hash);
      expect(id).toBe('content_abcdef1234567890');
    });
  });

  describe('validateStructure', () => {
    it('returns error for non-ZIP buffer', async () => {
      const buffer = new TextEncoder().encode('not a zip file').buffer;
      const result = await service.validateStructure(buffer);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].code).toBe('INVALID_ZIP');
    });

    it('returns MISSING_H5P_JSON error when h5p.json is absent', async () => {
      const zip = new JSZip();
      zip.file('some-other-file.txt', 'content');
      const buffer = await zip.generateAsync({ type: 'arraybuffer' });
      const result = await service.validateStructure(buffer);
      expect(result.errors.some(e => e.code === 'MISSING_H5P_JSON')).toBe(true);
    });

    it('returns error for invalid JSON in h5p.json', async () => {
      const zip = new JSZip();
      zip.file('h5p.json', 'not valid json {{{');
      const buffer = await zip.generateAsync({ type: 'arraybuffer' });
      const result = await service.validateStructure(buffer);
      expect(result.errors.some(e => e.code === 'INVALID_H5P_JSON')).toBe(true);
    });

    it('returns MISSING_CONTENT error when content directory is absent', async () => {
      const zip = new JSZip();
      zip.file('h5p.json', JSON.stringify({ title: 'Test', mainLibrary: 'H5P.Test', language: 'en', preloadedDependencies: [] }));
      const buffer = await zip.generateAsync({ type: 'arraybuffer' });
      const result = await service.validateStructure(buffer);
      expect(result.errors.some(e => e.code === 'MISSING_CONTENT')).toBe(true);
    });

    it('returns warning when content.json is missing', async () => {
      const zip = new JSZip();
      zip.file('h5p.json', JSON.stringify({ title: 'Test', mainLibrary: 'H5P.Test', language: 'en', preloadedDependencies: [] }));
      zip.file('content/something.txt', 'data');
      const buffer = await zip.generateAsync({ type: 'arraybuffer' });
      const result = await service.validateStructure(buffer);
      expect(result.warnings.some(w => w.includes('content.json'))).toBe(true);
    });

    it('returns success for valid h5p package structure', async () => {
      const buffer = await createValidH5PZip();
      const result = await service.validateStructure(buffer);
      expect(result.errors.length).toBe(0);
      expect(result.h5pJson).toBeDefined();
      expect(result.h5pJson?.mainLibrary).toBe('H5P.InteractiveBook');
    });

    it('adds warning for missing dependencies', async () => {
      const buffer = await createValidH5PZip(true, true);
      const result = await service.validateStructure(buffer);
      expect(result.warnings.some(w => w.includes('H5P.SomeLib-1.0'))).toBe(true);
    });
  });

  describe('validatePackageSize', () => {
    it('returns null for small packages', () => {
      const buffer = new TextEncoder().encode('small').buffer;
      expect(service.validatePackageSize(buffer)).toBeNull();
    });

    it('returns error for packages exceeding max size', () => {
      const largeBuffer = new ArrayBuffer(600 * 1024 * 1024);
      const result = service.validatePackageSize(largeBuffer);
      expect(result).not.toBeNull();
      expect(result?.code).toBe('PACKAGE_TOO_LARGE');
    });

    it('returns null when exactly at limit', () => {
      const buffer = new ArrayBuffer(500 * 1024 * 1024);
      expect(service.validatePackageSize(buffer)).toBeNull();
    });

    it('accepts custom max size', () => {
      const buffer = new ArrayBuffer(200);
      const result = service.validatePackageSize(buffer, 100);
      expect(result).not.toBeNull();
      expect(result?.code).toBe('PACKAGE_TOO_LARGE');
    });
  });

  describe('isInteractiveBook', () => {
    it('returns true for H5P.InteractiveBook', () => {
      expect(service.isInteractiveBook('H5P.InteractiveBook')).toBe(true);
    });

    it('returns false for other content types', () => {
      expect(service.isInteractiveBook('H5P.QuestionSet')).toBe(false);
      expect(service.isInteractiveBook('H5P.CoursePresentation')).toBe(false);
      expect(service.isInteractiveBook('')).toBe(false);
    });
  });

  describe('importPackage', () => {
    it('returns failed status when h5p.json is missing', async () => {
      const zip = new JSZip();
      zip.file('readme.txt', 'no h5p content here');
      const buffer = await zip.generateAsync({ type: 'arraybuffer' });
      const result = await service.importPackage('test.h5p', buffer);
      expect(result.status).toBe('failed');
    });

    it('returns failed status for non-ZIP input', async () => {
      const buffer = new TextEncoder().encode('not a zip').buffer;
      const result = await service.importPackage('test.h5p', buffer);
      expect(result.status).toBe('failed');
    });

    it('returns success for valid package', async () => {
      const buffer = await createValidH5PZip();
      const result = await service.importPackage('valid.h5p', buffer);
      expect(result.status).toBe('success');
      expect(result.contentId).toMatch(/^content_/);
      expect(result.primaryContentType).toBe('H5P.InteractiveBook');
    });

    it('returns warnings status when dependencies are missing', async () => {
      const buffer = await createValidH5PZip(true, true);
      const result = await service.importPackage('warn.h5p', buffer);
      expect(result.status).toBe('warnings');
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('returns consistent contentId for same file', async () => {
      const buffer = await createValidH5PZip();
      const result1 = await service.importPackage('test.h5p', buffer);
      const result2 = await service.importPackage('test.h5p', buffer);
      expect(result1.contentId).toBe(result2.contentId);
    });
  });

  describe('detectLibraries', () => {
    it('returns empty array when no preloadedDependencies', () => {
      const h5pJson = { title: 'T', mainLibrary: 'H5P.Test', language: 'en', preloadedDependencies: [] };
      expect(service.detectLibraries(h5pJson, '/path')).toEqual([]);
    });

    it('maps dependencies to DetectedLibrary objects', () => {
      const h5pJson = {
        title: 'T',
        mainLibrary: 'H5P.Test',
        language: 'en',
        preloadedDependencies: [{ machineName: 'H5P.Lib', majorVersion: 2, minorVersion: 3 }],
      };
      const libs = service.detectLibraries(h5pJson, '/path');
      expect(libs).toHaveLength(1);
      expect(libs[0].machineName).toBe('H5P.Lib');
      expect(libs[0].majorVersion).toBe(2);
      expect(libs[0].minorVersion).toBe(3);
      expect(libs[0].present).toBe(true);
    });
  });
});
