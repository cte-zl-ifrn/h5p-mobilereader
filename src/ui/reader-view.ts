/** Placeholder for extracting reader view rendering into its own module. View logic currently lives in App. */
import { ContentPackage } from '../types';

export function buildReaderShell(pkg: ContentPackage): string {
  return `
    <div class="reader-view">
      <div class="reader-toolbar">
        <button id="btn-back" class="btn-secondary">← Back</button>
        <span id="reader-title" class="reader-title">${pkg.manifest.h5pJson.title}</span>
        <button id="btn-reader-diagnostics" class="btn-secondary">Diagnostics</button>
      </div>
      <div id="h5p-container" class="h5p-container"></div>
    </div>
  `;
}
