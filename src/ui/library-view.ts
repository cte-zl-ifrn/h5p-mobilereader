/** Placeholder for extracting library view rendering into its own module. View logic currently lives in App. */
import { LibraryItem } from '../types';

export function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderLibraryItemCard(item: LibraryItem): string {
  const statusClass = item.status === 'available' ? 'status-ok' : item.status === 'broken' ? 'status-broken' : 'status-processing';
  const progressBar = item.progress > 0
    ? `<div class="progress-bar"><div class="progress-fill" style="width:${item.progress}%"></div></div>`
    : '';
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
