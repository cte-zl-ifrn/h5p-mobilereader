import { ImportResult, ValidationError, H5PJson, DetectedLibrary } from '../types';

export class ContentService {
  private extractionBasePath: string;

  constructor(extractionBasePath: string = './data/content') {
    this.extractionBasePath = extractionBasePath;
  }

  async importPackage(filePath: string, fileBuffer: ArrayBuffer): Promise<ImportResult> {
    const hash = await this.calculateHash(fileBuffer);
    const contentId = this.generateContentId(hash);
    
    const validationResult = await this.validateStructure(fileBuffer);
    if (validationResult.errors.length > 0 && validationResult.errors.some(e => e.code === 'MISSING_H5P_JSON')) {
      return {
        contentId,
        hash,
        status: 'failed',
        warnings: validationResult.errors.map(e => e.message),
        detectedLibraries: [],
        primaryContentType: 'unknown',
      };
    }

    if (validationResult.errors.length > 0) {
      return {
        contentId,
        hash,
        status: 'failed',
        warnings: validationResult.errors.map(e => e.message),
        detectedLibraries: [],
        primaryContentType: 'unknown',
      };
    }

    const extractedPath = `${this.extractionBasePath}/${contentId}`;
    await this.extractPackage(fileBuffer, extractedPath);

    const h5pJson = validationResult.h5pJson!;
    const detectedLibraries = this.detectLibraries(h5pJson, extractedPath);

    return {
      contentId,
      hash,
      status: validationResult.warnings.length > 0 ? 'warnings' : 'success',
      warnings: validationResult.warnings,
      detectedLibraries,
      primaryContentType: h5pJson.mainLibrary,
    };
  }

  async calculateHash(buffer: ArrayBuffer): Promise<string> {
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  generateContentId(hash: string): string {
    return `content_${hash.substring(0, 16)}`;
  }

  async validateStructure(fileBuffer: ArrayBuffer): Promise<{
    errors: ValidationError[];
    warnings: string[];
    h5pJson?: H5PJson;
  }> {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    try {
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(fileBuffer);
      
      const h5pJsonFile = zip.file('h5p.json');
      if (!h5pJsonFile) {
        errors.push({
          code: 'MISSING_H5P_JSON',
          message: 'Missing required file: h5p.json',
        });
        return { errors, warnings };
      }

      const h5pJsonContent = await h5pJsonFile.async('string');
      let h5pJson: H5PJson;
      try {
        h5pJson = JSON.parse(h5pJsonContent);
      } catch {
        errors.push({
          code: 'INVALID_H5P_JSON',
          message: 'h5p.json is not valid JSON',
        });
        return { errors, warnings };
      }

      const contentFiles = Object.keys(zip.files).filter(f => f.startsWith('content/'));
      if (contentFiles.length === 0) {
        errors.push({
          code: 'MISSING_CONTENT',
          message: 'Missing content directory in package',
        });
      }

      const contentJson = zip.file('content/content.json');
      if (!contentJson) {
        warnings.push('Missing content/content.json - package may be incomplete');
      }

      if (h5pJson.preloadedDependencies) {
        for (const dep of h5pJson.preloadedDependencies) {
          const libPath = `${dep.machineName}-${dep.majorVersion}.${dep.minorVersion}`;
          const libFiles = Object.keys(zip.files).filter(f => f.startsWith(libPath + '/') || f.startsWith('libraries/' + libPath + '/'));
          if (libFiles.length === 0) {
            warnings.push(`Library ${libPath} not found in package - may need to be provided separately`);
          }
        }
      }

      return { errors, warnings, h5pJson };
    } catch (error) {
      errors.push({
        code: 'INVALID_ZIP',
        message: `Failed to read package as ZIP: ${error instanceof Error ? error.message : String(error)}`,
      });
      return { errors, warnings };
    }
  }

  async extractPackage(fileBuffer: ArrayBuffer, targetPath: string): Promise<void> {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(fileBuffer);
    
    const extractionPromises: Promise<void>[] = [];
    zip.forEach((relativePath, file) => {
      if (!file.dir) {
        extractionPromises.push(
          file.async('arraybuffer').then((_data) => {
            // In production: write to `${targetPath}/${relativePath}`
          })
        );
      }
    });
    await Promise.all(extractionPromises);
  }

  detectLibraries(h5pJson: H5PJson, _extractedPath: string): DetectedLibrary[] {
    if (!h5pJson.preloadedDependencies) return [];
    
    return h5pJson.preloadedDependencies.map(dep => ({
      machineName: dep.machineName,
      majorVersion: dep.majorVersion,
      minorVersion: dep.minorVersion,
      present: true,
    }));
  }

  validatePackageSize(buffer: ArrayBuffer, maxSizeBytes: number = 500 * 1024 * 1024): ValidationError | null {
    if (buffer.byteLength > maxSizeBytes) {
      return {
        code: 'PACKAGE_TOO_LARGE',
        message: `Package size ${buffer.byteLength} exceeds maximum ${maxSizeBytes} bytes`,
      };
    }
    return null;
  }

  isInteractiveBook(primaryContentType: string): boolean {
    return primaryContentType === 'H5P.InteractiveBook';
  }
}
