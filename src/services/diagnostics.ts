import { EventLog } from '../types';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface DiagnosticEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  contentId?: string;
}

export class DiagnosticsService {
  private entries: DiagnosticEntry[] = [];
  private maxEntries: number;

  constructor(maxEntries: number = 1000) {
    this.maxEntries = maxEntries;
  }

  log(level: LogLevel, message: string, context?: Record<string, unknown>, contentId?: string): void {
    const entry: DiagnosticEntry = {
      timestamp: new Date(),
      level,
      message,
      context,
      contentId,
    };
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }
    const consoleFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    consoleFn(`[${level.toUpperCase()}] ${message}`, context ?? '');
  }

  debug(message: string, context?: Record<string, unknown>, contentId?: string): void {
    this.log('debug', message, context, contentId);
  }

  info(message: string, context?: Record<string, unknown>, contentId?: string): void {
    this.log('info', message, context, contentId);
  }

  warn(message: string, context?: Record<string, unknown>, contentId?: string): void {
    this.log('warn', message, context, contentId);
  }

  error(message: string, context?: Record<string, unknown>, contentId?: string): void {
    this.log('error', message, context, contentId);
  }

  getEntriesForContent(contentId: string): DiagnosticEntry[] {
    return this.entries.filter(e => e.contentId === contentId);
  }

  getRecentErrors(limit: number = 50): DiagnosticEntry[] {
    return this.entries
      .filter(e => e.level === 'error' || e.level === 'warn')
      .slice(-limit);
  }

  getAllEntries(): DiagnosticEntry[] {
    return [...this.entries];
  }

  exportAsText(): string {
    return this.entries
      .map(e => `[${e.timestamp.toISOString()}] [${e.level.toUpperCase()}] ${e.message}${e.context ? ' ' + JSON.stringify(e.context) : ''}`)
      .join('\n');
  }

  clear(): void {
    this.entries = [];
  }

  toEventLog(entry: DiagnosticEntry, contentId: string): EventLog {
    return {
      id: `${entry.timestamp.getTime()}_${Math.random().toString(36).slice(2)}`,
      timestamp: entry.timestamp,
      eventType: entry.level === 'error' ? 'error' : 'opened',
      contentId,
      payload: { message: entry.message, ...entry.context },
      syncStatus: 'pending',
    };
  }
}
