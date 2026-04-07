/** Placeholder for extracting diagnostics view rendering into its own module. View logic currently lives in App. */
import { DiagnosticEntry } from '../services/diagnostics';
import { escapeHtml } from './library-view';

export function renderDiagnosticEntry(entry: DiagnosticEntry): string {
  return `
    <div class="log-entry log-${entry.level}">
      <span class="log-time">${entry.timestamp.toISOString()}</span>
      <span class="log-level">[${entry.level.toUpperCase()}]</span>
      <span class="log-msg">${escapeHtml(entry.message)}</span>
      ${entry.context ? `<pre class="log-context">${escapeHtml(JSON.stringify(entry.context, null, 2))}</pre>` : ''}
    </div>
  `;
}
