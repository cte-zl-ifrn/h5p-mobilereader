import { H5PJson, LibraryItem, ContentPackage, ContentManifest, DetectedLibrary } from '../types';

export class MetadataIndexer {
  parseH5PJson(jsonContent: string): H5PJson {
    const raw = JSON.parse(jsonContent);
    return {
      title: raw.title || 'Untitled',
      mainLibrary: raw.mainLibrary || 'unknown',
      language: raw.language || 'en',
      license: raw.license,
      authors: raw.authors,
      preloadedDependencies: raw.preloadedDependencies || [],
    };
  }

  buildLibraryItem(
    contentId: string,
    h5pJson: H5PJson,
    hash: string,
    size: number,
    warnings: string[]
  ): LibraryItem {
    return {
      id: contentId,
      title: h5pJson.title,
      author: h5pJson.authors?.[0]?.name,
      primaryContentType: h5pJson.mainLibrary,
      packageHash: hash,
      importedAt: new Date(),
      size,
      status: warnings.length > 0 ? 'broken' : 'available',
      progress: 0,
      isFavorite: false,
    };
  }

  buildContentPackage(
    contentId: string,
    originalPath: string,
    extractedPath: string,
    h5pJson: H5PJson,
    hash: string,
    warnings: string[],
    libraries: DetectedLibrary[]
  ): ContentPackage {
    const manifest: ContentManifest = {
      hash,
      importedAt: new Date(),
      h5pJson,
      warnings,
    };

    return {
      contentId,
      originalPackagePath: originalPath,
      extractedPath,
      manifest,
      detectedLibraries: libraries,
      compatiblePlayerVersion: '3.8.2',
    };
  }

  extractTitle(h5pJson: H5PJson): string {
    return h5pJson.title || 'Untitled';
  }

  extractAuthor(h5pJson: H5PJson): string | undefined {
    return h5pJson.authors?.[0]?.name;
  }

  isPriorityContentType(mainLibrary: string): boolean {
    const priorityTypes = ['H5P.InteractiveBook', 'H5P.CoursePresentation', 'H5P.QuestionSet', 'H5P.InteractiveVideo'];
    return priorityTypes.includes(mainLibrary);
  }

  getMissingLibraries(libraries: DetectedLibrary[]): DetectedLibrary[] {
    return libraries.filter(lib => !lib.present);
  }

  formatLibraryName(lib: DetectedLibrary): string {
    return `${lib.machineName}-${lib.majorVersion}.${lib.minorVersion}`;
  }
}
