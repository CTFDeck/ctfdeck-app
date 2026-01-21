export type FilePrefix = 'dir' | 'arc' | 'bin' | 'lnk' | 'txt' | 'img' | 'vid' | 'aud' | 'unk';

export interface LsEntry {
  prefix: FilePrefix;
  name: string;
  coloredName: string; // Original ANSI-colored name from ls output
}

export interface TerminalLine {
  type: 'command' | 'output' | 'error' | 'info' | 'ls';
  content: any; // Allow SafeHtml
  timestamp: Date;
  lsEntries?: LsEntry[];
}
