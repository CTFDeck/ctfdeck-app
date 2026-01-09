import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  AfterViewChecked,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { WebSocketService } from '../../app/core/services/websocket.service';
import { Subscription } from 'rxjs';
import { HlmButtonImports } from '@ctfdeck/helm/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideServer, lucidePlus, lucideTrash2 } from '@ng-icons/lucide';
import AnsiToHtml from 'ansi-to-html';

type FilePrefix = 'dir' | 'arc' | 'bin' | 'lnk' | 'txt' | 'img' | 'vid' | 'aud' | 'unk';

interface LsEntry {
  prefix: FilePrefix;
  name: string;
  coloredName: string; // Original ANSI-colored name from ls output
}

interface TerminalLine {
  type: 'command' | 'output' | 'error' | 'info' | 'ls';
  content: any; // Allow SafeHtml
  timestamp: Date;
  lsEntries?: LsEntry[];
}

@Component({
  selector: 'app-terminal',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIcon, HlmButtonImports],
  providers: [
    provideIcons({
      lucideServer,
      lucidePlus,
      lucideTrash2,
    }),
  ],
  templateUrl: './terminal.component.html',
  styleUrls: ['./terminal.component.css'],
})
export class TerminalComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;
  @ViewChild('commandInput') private commandInput!: ElementRef<HTMLInputElement>;

  lines: TerminalLine[] = [];
  currentCommand: string = '';
  isConnected: boolean = false;

  prompt: string = '$';
  private lastPwd: string = '';

  private lastLsEntries: LsEntry[] = [];

  // Autocomplete suggestions shown near the input
  autocompleteSuggestions: LsEntry[] = [];

  showServerSelection: boolean = false;
  serverUrl: string = '';
  savedServers: string[] = ['ws://localhost:42712', 'wss://echo.websocket.org'];

  private subscriptions: Subscription = new Subscription();
  private commandHistory: string[] = [];
  private historyIndex: number = -1;
  private ansiConverter = new AnsiToHtml({
    fg: '#d4d4d4',
    bg: '#1e1e1e',
    newline: true,
    colors: {
      4: '#61afef', // Softer blue
      34: '#61afef', // Softer blue
    },
  });

  constructor(
    private wsService: WebSocketService,
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer,
  ) {
    this.serverUrl = this.wsService.getUrl();
  }

  toggleServerSelection(event?: Event) {
    if (event) event.stopPropagation();
    this.showServerSelection = !this.showServerSelection;
  }

  ngOnInit(): void {
    this.subscriptions.add(
      this.wsService.isConnected$.subscribe((connected) => {
        this.isConnected = connected;
        if (!connected) {
          this.addLine('info', 'Disconnected from server.');
        }
      }),
    );

    this.connect();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.wsService.disconnect();
  }

  ngAfterViewChecked(): void {}

  private connect() {
    this.wsService
      .connect()
      .then(() => {
        this.addLine('info', 'Connected to WebSocket server.');
        this.addLine('info', 'Type "help" for a list of available commands or just type away!');
        this.scrollToBottom();

        // Initialize prompt and autocomplete cache
        this.initializeTerminalState();
      })
      .catch((err) => {
        this.addLine('error', `Connection failed: ${err?.message || 'Unknown error'}`);
      });
  }

  /**
   * Initialize terminal state: get current directory and populate autocomplete cache
   */
  private initializeTerminalState() {
    // Run pwd to get initial working directory
    this.wsService
      .executeCommandStreaming(
        'pwd',
        () => {}, // Ignore output (we get workingDirectory from result)
        () => {},
      )
      .then((result) => {
        if (result.workingDirectory) {
          this.updatePwd(result.workingDirectory);
        }
        // Also refresh autocomplete cache
        this.refreshAutocompleteCache();
      })
      .catch(() => {
        // Silently fail
      });
  }

  executeCommand() {
    const cmd = this.currentCommand.trim();
    if (!cmd) return;

    this.commandHistory.push(cmd);
    this.historyIndex = this.commandHistory.length;

    this.addLine('command', `${this.prompt} ${cmd}`);
    this.currentCommand = '';

    if (cmd === 'clear' || cmd === 'cls') {
      this.lines = [];
      return;
    }

    if (cmd === 'connect') {
      this.addLine('info', 'Connecting to server...');
      this.connect();
      return;
    }

    if (cmd === 'disconnect') {
      this.addLine('info', 'Disconnecting from server...');
      this.wsService.disconnect();
      return;
    }

    if (!this.isConnected) {
      this.addLine('error', 'Not connected to server.');
      return;
    }

    // Track streaming output with a buffer
    let outputLineIndex = -1;
    let outputBuffer = '';
    let errorBuffer = '';

    // Use streaming execution
    this.wsService
      .executeCommandStreaming(
        cmd,
        // onOutput callback - called for each stdout chunk
        (data: string) => {
          outputBuffer += data;

          // Update autocomplete cache if this looks like directory listing
          if (this.looksLikeDirectoryListing(cmd)) {
            this.updateLsCache(outputBuffer);
          }

          // Create output line if first chunk, otherwise update existing
          if (outputLineIndex === -1) {
            outputLineIndex = this.lines.length;
            this.lines.push({
              type: 'output',
              content: '',
              timestamp: new Date(),
            });
          }

          // Update the output line with the full buffer (re-render ANSI each time)
          const html = this.ansiConverter.toHtml(outputBuffer);
          this.lines[outputLineIndex].content = this.sanitizer.bypassSecurityTrustHtml(html);
          this.cdr.detectChanges();
          this.scrollToBottom();
        },
        // onError callback - called for each stderr chunk
        (data: string) => {
          errorBuffer += data;
          this.appendToLastError(data);
          this.scrollToBottom();
        },
      )
      .then((result) => {
        // Stream completed
        if (result.workingDirectory) {
          this.updatePwd(result.workingDirectory);
        }

        if (result.exitCode !== 0 && !errorBuffer) {
          this.addLine('error', `Program exited with code ${result.exitCode}`);
        }

        // Auto-refresh autocomplete cache after directory changes
        if (this.looksLikeDirectoryChange(cmd)) {
          this.refreshAutocompleteCache();
        }

        this.scrollToBottom();
      })
      .catch((err) => {
        this.addLine('error', `Execution failed: ${err?.message || err}`);
      });
  }

  /**
   */
  private appendToLastError(data: string) {
    // Check if last line is an error line we can append to
    const lastLine = this.lines[this.lines.length - 1];
    if (lastLine && lastLine.type === 'error') {
      lastLine.content = (lastLine.content || '') + data;
      this.cdr.detectChanges();
    } else {
      this.addLine('error', data);
    }
  }

  /**
   * Silently refreshes the autocomplete cache by running ls in the background
   */
  private refreshAutocompleteCache() {
    let output = '';
    this.wsService
      .executeCommandStreaming(
        'ls',
        (data) => {
          output += data;
        },
        () => {},
      )
      .then(() => {
        if (output) {
          this.updateLsCache(output);
        }
      })
      .catch(() => {
        // Silently fail - autocomplete cache will just be stale
      });
  }

  private looksLikeDirectoryChange(cmd: string): boolean {
    const trimmed = cmd.trim();
    if (!trimmed) return false;
    const parts = trimmed.split(/\s+/);
    const base = (parts[0] || '').toLowerCase();
    return base === 'cd' || base === 'pushd' || base === 'popd';
  }

  private updatePwd(workingDirectory: string) {
    const pwd = (workingDirectory || '').trim();
    if (!pwd) return;

    // Convert Windows path to Unix-style for display if needed
    const displayPath = pwd.replace(/\\/g, '/');

    // Shorten home directory to ~
    const home = this.getHomePath();
    const shortPath =
      home && displayPath.startsWith(home) ? '~' + displayPath.slice(home.length) : displayPath;

    this.lastPwd = pwd;
    this.prompt = `${shortPath} $`;
    this.cdr.detectChanges();
  }

  private getHomePath(): string {
    // Try to detect home directory from the path pattern
    // This is a heuristic - works for common cases
    const match = this.lastPwd.match(
      /^(\/[a-z]\/Users\/[^\/]+|\/home\/[^\/]+|C:\\Users\\[^\\/]+)/i,
    );
    if (match) {
      return match[1].replace(/\\/g, '/');
    }
    return '';
  }

  private updateLsCache(lsOutput: string) {
    this.lastLsEntries = this.parseLs(lsOutput);
  }

  private parseLs(lsOutput: string): LsEntry[] {
    // Build a map of stripped name -> original colored segment AND detected type from ANSI
    const { coloredMap, typeMap } = this.buildColoredNameMapWithTypes(lsOutput);

    // Strip ANSI codes for parsing
    const cleanOutput = this.stripAnsi(lsOutput);

    // Split by whitespace to handle both single-column and multi-column (wide) output
    const items = cleanOutput
      .split(/\s+/)
      .map((item) => item.trim())
      .filter((item) => item && item !== 'total' && !/^\d+$/.test(item));

    const out: LsEntry[] = [];
    for (const name of items) {
      if (name === '.' || name === '..') continue;

      // First try to detect type from ANSI color codes
      let prefix: FilePrefix = typeMap.get(name) || 'unk';

      // If no ANSI type detected, fall back to extension-based detection
      if (prefix === 'unk') {
        prefix = this.detectFileTypeFromName(name);
      }

      // Get the original colored name if available, otherwise use plain name
      const coloredName = coloredMap.get(name) || name;
      out.push({ prefix, name, coloredName });
    }
    return out;
  }

  /**
   * Detect file type from name/extension as a fallback
   */
  private detectFileTypeFromName(name: string): FilePrefix {
    if (name.endsWith('/') || name.endsWith('\\')) {
      return 'dir';
    }

    // Check if it's likely a directory (no extension, or starts with dot and no other dot)
    const parts = name.split('.');
    const ext = parts.length > 1 ? parts.pop()?.toLowerCase() : undefined;

    if (!ext) {
      // No extension - could be directory or extensionless file
      // Common directories without extensions
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

  /**
   * Builds a map from stripped name -> original ANSI-colored segment,
   * AND detects file type from ANSI color codes.
   */
  private buildColoredNameMapWithTypes(lsOutput: string): {
    coloredMap: Map<string, string>;
    typeMap: Map<string, FilePrefix>;
  } {
    const coloredMap = new Map<string, string>();
    const typeMap = new Map<string, FilePrefix>();

    // Match ANSI-colored segments: sequences of ANSI codes followed by text
    // Pattern: ANSI codes, then non-whitespace text, then optional reset
    const ansiPattern = /((?:\x1B\[[0-9;]*m)+)([^\s\x1B]+)((?:\x1B\[[0-9;]*m)*)/g;

    let match;
    while ((match = ansiPattern.exec(lsOutput)) !== null) {
      const ansiCodes = match[1] || '';
      const text = match[2];
      const suffix = match[3] || '';

      // Skip 'total' and pure numbers (from ls -l output)
      if (text === 'total' || /^\d+$/.test(text)) continue;
      if (text === '.' || text === '..') continue;

      // Store the full colored segment
      const coloredSegment = ansiCodes + text + suffix;
      coloredMap.set(text, coloredSegment);

      // Detect file type from ANSI SGR codes
      // Common LS_COLORS mappings:
      // 34 or 01;34 = directory (blue)
      // 32 or 01;32 = executable (green)
      // 36 or 01;36 = symlink (cyan)
      // 31 or 01;31 = archive (red)
      // 33 or 01;33 = device/special (yellow)
      // 35 or 01;35 = image/video (magenta)
      const type = this.detectTypeFromAnsiCode(ansiCodes);
      if (type !== 'unk') {
        typeMap.set(text, type);
      }
    }

    return { coloredMap, typeMap };
  }

  /**
   * Detect file type from ANSI SGR color codes
   */
  private detectTypeFromAnsiCode(ansiCode: string): FilePrefix {
    // Extract the SGR parameters (the numbers between [ and m)
    const match = ansiCode.match(/\[([0-9;]+)m/);
    if (!match) return 'unk';

    const params = match[1].split(';').map((p) => parseInt(p, 10));

    // Check for foreground colors (30-37 normal, 90-97 bright)
    for (const param of params) {
      // Blue = directory
      if (param === 34 || param === 94) return 'dir';
      // Green = executable/binary
      if (param === 32 || param === 92) return 'bin';
      // Cyan = symlink
      if (param === 36 || param === 96) return 'lnk';
      // Red = archive
      if (param === 31 || param === 91) return 'arc';
      // Magenta = image/media
      if (param === 35 || param === 95) return 'img';
      // Yellow = special/device
      if (param === 33 || param === 93) return 'unk';
    }

    return 'unk';
  }

  private stripAnsi(text: string): string {
    return text.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
  }

  classForPrefix(prefix: FilePrefix): string {
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

  private addLsGrid(lsOutput: string) {
    const entries = this.parseLs(lsOutput);

    this.lines.push({
      type: 'ls',
      content: '',
      timestamp: new Date(),
      lsEntries: entries,
    });

    this.cdr.detectChanges();
  }

  private looksLikeDirectoryListing(cmd: string): boolean {
    const trimmed = cmd.trim();
    if (!trimmed) return false;

    const parts = trimmed.split(/\s+/);
    const base = (parts[0] || '').toLowerCase();

    return base === 'ls' || base === 'dir';
  }

  onTabAutocomplete(event: Event) {
    const e = event as KeyboardEvent;
    e.preventDefault();

    if (this.lastLsEntries.length === 0) return;

    const raw = this.currentCommand;
    const hasTrailingSpace = /\s$/.test(raw);
    const trimmed = raw.trim();

    if (!trimmed) return;

    const tokens = trimmed.split(/\s+/);

    if (tokens.length === 1 && !hasTrailingSpace) {
      this.currentCommand = raw + ' ';
      return;
    }

    const lastToken = hasTrailingSpace ? '' : (tokens[tokens.length - 1] ?? '');

    const candidates = this.lastLsEntries
      .map((x) => x.name)
      .filter((name) => name.startsWith(lastToken));

    if (candidates.length === 0) return;

    const prefixText = hasTrailingSpace
      ? raw
      : raw.replace(new RegExp(`${this.escapeRegex(lastToken)}$`), '');

    if (candidates.length === 1) {
      this.currentCommand = prefixText + candidates[0] + ' ';
      return;
    }

    const common = this.commonPrefix(candidates);
    if (common.length > lastToken.length) {
      this.currentCommand = prefixText + common;
      return;
    }

    // Get full LsEntry objects for colored display
    const candidateEntries = this.lastLsEntries.filter((e) => e.name.startsWith(lastToken));
    this.showAutocompleteSuggestions(candidateEntries);
    this.scrollToBottom();
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

  private addLine(type: 'command' | 'output' | 'error' | 'info', content: string) {
    // Convert ANSI codes to HTML for output lines
    if (type === 'output') {
      console.log('Received output content:', JSON.stringify(content));
    }

    let renderedContent: SafeHtml | string = content;

    if (type === 'output') {
      const html = this.ansiConverter.toHtml(content);
      renderedContent = this.sanitizer.bypassSecurityTrustHtml(html);
    }

    this.lines.push({
      type,
      content: renderedContent as string,
      timestamp: new Date(),
    });
    this.cdr.detectChanges();
  }

  /**
   * Shows autocomplete suggestions near the input.
   * Uses CSS class-based colors for consistent display.
   */
  private showAutocompleteSuggestions(candidates: LsEntry[]) {
    this.autocompleteSuggestions = candidates;
    this.cdr.detectChanges();
  }

  /**
   * Clears autocomplete suggestions
   */
  clearAutocompleteSuggestions() {
    if (this.autocompleteSuggestions.length > 0) {
      this.autocompleteSuggestions = [];
      this.cdr.detectChanges();
    }
  }

  private scrollToBottom(): void {
    try {
      this.commandInput.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
    } catch {}
  }

  navigateHistory(direction: 'up' | 'down', event: Event) {
    event.preventDefault();

    if (this.commandHistory.length === 0) return;

    if (direction === 'up') {
      if (this.historyIndex > 0) {
        this.historyIndex--;
        this.currentCommand = this.commandHistory[this.historyIndex];
      }
    } else {
      if (this.historyIndex < this.commandHistory.length - 1) {
        this.historyIndex++;
        this.currentCommand = this.commandHistory[this.historyIndex];
      } else {
        this.historyIndex = this.commandHistory.length;
        this.currentCommand = '';
      }
    }
  }

  focusInput(event?: Event) {
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) return;

    if (event && event.target instanceof HTMLElement) {
      const tag = event.target.tagName.toLowerCase();
      if (tag === 'input' || tag === 'button' || tag === 'textarea') return;
    }

    this.commandInput?.nativeElement?.focus();
  }

  reconnect() {
    this.wsService.disconnect();
    this.wsService.setUrl(this.serverUrl);
    this.connect();
  }

  saveServer() {
    if (this.serverUrl && !this.savedServers.includes(this.serverUrl)) {
      this.savedServers.push(this.serverUrl);
    }
  }

  removeServer(url: string, event: Event) {
    event.stopPropagation();
    this.savedServers = this.savedServers.filter((s) => s !== url);
  }

  selectServer(url: string) {
    this.serverUrl = url;
    this.reconnect();
  }
}
