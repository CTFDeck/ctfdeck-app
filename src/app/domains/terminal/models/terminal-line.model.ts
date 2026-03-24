import type { SafeHtml } from '@angular/platform-browser';
import type { LsEntry } from './ls-entry.model';

export type TerminalLineType = 'command' | 'output' | 'error' | 'info' | 'ls';

export interface TerminalLine {
  id: string;
  type: TerminalLineType;
  content: SafeHtml | string;
  timestamp: Date;
  lsEntries?: LsEntry[];
}
