import { FilePrefix, LsEntry } from './terminal-types';

export interface AutocompleteResult {
  newCommand: string;
  suggestions: LsEntry[];
}

export class TerminalAutocompleteHelper {
  private lastLsEntries: LsEntry[] = [];

  updateCache(lsOutput: string) {
    this.lastLsEntries = this.parseLs(lsOutput);
    return this.lastLsEntries;
  }

  getCache() {
    return this.lastLsEntries;
  }

  handleTab(currentCommand: string): AutocompleteResult {
    const result: AutocompleteResult = {
      newCommand: currentCommand,
      suggestions: [],
    };

    if (this.lastLsEntries.length === 0) return result;

    const raw = currentCommand;
    const hasTrailingSpace = /\s$/.test(raw);
    const trimmed = raw.trim();

    if (!trimmed) return result;

    const tokens = trimmed.split(/\s+/);

    if (tokens.length === 1 && !hasTrailingSpace) {
      result.newCommand = raw + ' ';
      return result;
    }

    const lastToken = hasTrailingSpace ? '' : (tokens[tokens.length - 1] ?? '');

    const candidates = this.lastLsEntries.filter((e) => e.name.startsWith(lastToken));

    if (candidates.length === 0) return result;

    const prefixText = hasTrailingSpace
      ? raw
      : raw.replace(new RegExp(`${this.escapeRegex(lastToken)}$`), '');

    if (candidates.length === 1) {
      result.newCommand = prefixText + candidates[0].name + ' ';
      return result;
    }

    const common = this.commonPrefix(candidates.map((c) => c.name));
    if (common.length > lastToken.length) {
      result.newCommand = prefixText + common;
      return result;
    }

    // Multiple candidates, no common prefix extension -> show suggestions
    result.suggestions = candidates;
    return result;
  }

  private commonPrefix(items: string[]): string {
    if (items.length === 0) return '';
    let prefix = items[0];
    for (let i = 1; i < items.length; i++) {
      while (!items[i].startsWith(prefix)) {
        prefix = prefix.slice(0, -1);
        if (!prefix) return '';
      }
    }
    return prefix;
  }

  private escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private parseLs(lsOutput: string): LsEntry[] {
    const { coloredMap, typeMap } = this.buildColoredNameMapWithTypes(lsOutput);
    const cleanOutput = this.stripAnsi(lsOutput);

    const items = cleanOutput
      .split(/\s+/)
      .map((item) => item.trim())
      .filter((item) => item && item !== 'total' && !/^\d+$/.test(item));

    const out: LsEntry[] = [];
    for (const name of items) {
      if (name === '.' || name === '..') continue;

      let prefix: FilePrefix = typeMap.get(name) || 'unk';

      if (prefix === 'unk') {
        prefix = this.detectFileTypeFromName(name);
      }

      const coloredName = coloredMap.get(name) || name;
      out.push({ prefix, name, coloredName });
    }
    return out;
  }

  private detectFileTypeFromName(name: string): FilePrefix {
    if (name.endsWith('/') || name.endsWith('\\')) {
      return 'dir';
    }

    const parts = name.split('.');
    const ext = parts.length > 1 ? parts.pop()?.toLowerCase() : undefined;

    if (!ext) {
      const commonDirs = [
        'src',
        'lib',
        'libs',
        'bin',
        'dist',
        'build',
        'tests',
        'test',
        'docs',
        'doc',
        'public',
        'assets',
        'electron',
      ];
      if (commonDirs.includes(name.toLowerCase())) {
        return 'dir';
      }
      return 'unk';
    }

    switch (ext) {
      case 'zip':
      case 'tar':
      case 'gz':
      case '7z':
      case 'rar':
        return 'arc';
      case 'exe':
      case 'dll':
      case 'so':
      case 'sh':
      case 'bat':
      case 'cmd':
        return 'bin';
      case 'txt':
      case 'md':
      case 'json':
      case 'js':
      case 'ts':
      case 'css':
      case 'html':
      case 'xml':
      case 'log':
      case 'yml':
      case 'yaml':
        return 'txt';
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'bmp':
      case 'svg':
      case 'webp':
      case 'ico':
        return 'img';
      case 'mp4':
      case 'avi':
      case 'mkv':
      case 'mov':
      case 'webm':
        return 'vid';
      case 'mp3':
      case 'wav':
      case 'ogg':
      case 'flac':
        return 'aud';
      case 'lnk':
        return 'lnk';
      default:
        return 'unk';
    }
  }

  private buildColoredNameMapWithTypes(lsOutput: string): {
    coloredMap: Map<string, string>;
    typeMap: Map<string, FilePrefix>;
  } {
    const coloredMap = new Map<string, string>();
    const typeMap = new Map<string, FilePrefix>();
    const ansiPattern = /((?:\x1B\[[0-9;]*m)+)([^\s\x1B]+)((?:\x1B\[[0-9;]*m)*)/g;

    let match;
    while ((match = ansiPattern.exec(lsOutput)) !== null) {
      const ansiCodes = match[1] || '';
      const text = match[2];
      const suffix = match[3] || '';

      if (text === 'total' || /^\d+$/.test(text)) continue;
      if (text === '.' || text === '..') continue;

      const coloredSegment = ansiCodes + text + suffix;
      coloredMap.set(text, coloredSegment);

      const type = this.detectTypeFromAnsiCode(ansiCodes);
      if (type !== 'unk') {
        typeMap.set(text, type);
      }
    }
    return { coloredMap, typeMap };
  }

  private detectTypeFromAnsiCode(ansiCode: string): FilePrefix {
    const match = ansiCode.match(/\[([0-9;]+)m/);
    if (!match) return 'unk';

    const params = match[1].split(';').map((p) => parseInt(p, 10));

    for (const param of params) {
      if (param === 34 || param === 94) return 'dir';
      if (param === 32 || param === 92) return 'bin';
      if (param === 36 || param === 96) return 'lnk';
      if (param === 31 || param === 91) return 'arc';
      if (param === 35 || param === 95) return 'img';
      if (param === 33 || param === 93) return 'unk';
    }
    return 'unk';
  }

  private stripAnsi(text: string): string {
    return text.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
  }

  public getClassForPrefix(prefix: FilePrefix): string {
    switch (prefix) {
      case 'dir':
        return 'ft-dir';
      case 'arc':
        return 'ft-arc';
      case 'bin':
        return 'ft-bin';
      case 'lnk':
        return 'ft-lnk';
      case 'txt':
        return 'ft-txt';
      case 'img':
        return 'ft-img';
      case 'vid':
        return 'ft-vid';
      case 'aud':
        return 'ft-aud';
      default:
        return 'ft-unk';
    }
  }
}
