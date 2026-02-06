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
import { TerminalLine, LsEntry, FilePrefix } from './helpers/terminal-types';
import { TerminalHistoryHelper } from './helpers/terminal-history.helper';
import { TerminalAutocompleteHelper } from './helpers/terminal-autocomplete.helper';
import { SessionStoreService } from '../../app/core/services/session-store.service';
import { SessionData } from '../../app/core/services/session.protocol';

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

  // Autocomplete suggestions shown near the input
  autocompleteSuggestions: LsEntry[] = [];

  showServerSelection: boolean = false;
  serverUrl: string = '';
  savedServers: string[] = ['ws://localhost:42712', 'wss://echo.websocket.org'];
  isSessionLoading: boolean = false;

  private subscriptions: Subscription = new Subscription();

  // Helpers
  private historyHelper = new TerminalHistoryHelper();
  public autocompleteHelper = new TerminalAutocompleteHelper();

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
    private sessionStore: SessionStoreService,
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

    this.subscriptions.add(
      this.sessionStore.activeSession$.subscribe((session) => {
        this.loadSessionHistory(session);
      }),
    );

    this.subscriptions.add(
      this.sessionStore.isLoading$.subscribe((loading) => {
        this.isSessionLoading = loading;
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
        this.initializeTerminalState();
      })
      .catch((err) => {
        this.addLine('error', `Connection failed: ${err?.message || 'Unknown error'}`);
      });
  }

  private initializeTerminalState() {
    this.wsService
      .executeCommandStreaming(
        'pwd',
        () => {},
        () => {},
      )
      .then((result) => {
        if (result.workingDirectory) {
          this.updatePwd(result.workingDirectory);
        }
        this.refreshAutocompleteCache();
      })
      .catch(() => {});
  }

  async executeCommand() {
    const cmd = this.currentCommand.trim();
    if (!cmd) return;

    this.historyHelper.add(cmd);

    this.addLine('command', `${this.prompt} ${cmd}`);
    this.currentCommand = '';

    // Clear autocomplete when executing
    this.clearAutocompleteSuggestions();

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

    if (this.isSessionLoading) {
      this.addLine('info', 'Session is loading. Please wait...');
      return;
    }

    try {
      await this.sessionStore.ensureActiveSession();
    } catch (err: any) {
      this.addLine('error', `Session error: ${err?.message || err}`);
      return;
    }

    // High-performance streaming
    let outputLineIndex = -1;
    let outputBuffer = '';
    let errorBuffer = '';
    let pendingRender = false;
    let lastRenderTime = 0;
    const MIN_RENDER_INTERVAL = 16;

    const scheduleRender = () => {
      if (pendingRender) return;
      const now = performance.now();
      if (now - lastRenderTime < MIN_RENDER_INTERVAL) {
        pendingRender = true;
        requestAnimationFrame(() => {
          pendingRender = false;
          lastRenderTime = performance.now();
          this.renderOutputBuffer(outputLineIndex, outputBuffer);
        });
      } else {
        lastRenderTime = now;
        this.renderOutputBuffer(outputLineIndex, outputBuffer);
      }
    };

    this.wsService
      .executeCommandStreaming(
        cmd,
        (data: string) => {
          outputBuffer += data;
          if (outputLineIndex === -1) {
            outputLineIndex = this.lines.length;
            this.lines.push({
              type: 'output',
              content: '',
              timestamp: new Date(),
            });
          }
          scheduleRender();
        },
        (data: string) => {
          errorBuffer += data;
          this.appendToLastError(data);
        },
      )
      .then((result) => {
        if (outputLineIndex >= 0) {
          this.renderOutputBuffer(outputLineIndex, outputBuffer);
        }

        if (this.looksLikeDirectoryListing(cmd)) {
          this.updateLsCache(outputBuffer);
        }

        if (result.workingDirectory) {
          this.updatePwd(result.workingDirectory);
        }

        if (result.exitCode !== 0 && !errorBuffer) {
          this.addLine('error', `Program exited with code ${result.exitCode}`);
        }

        if (this.looksLikeDirectoryChange(cmd)) {
          this.refreshAutocompleteCache();
        }

        this.scrollToBottom();
      })
      .catch((err) => {
        this.addLine('error', `Execution failed: ${err?.message || err}`);
      });
  }

  private renderOutputBuffer(lineIndex: number, buffer: string): void {
    if (lineIndex < 0 || lineIndex >= this.lines.length) return;
    const html = this.ansiConverter.toHtml(buffer);
    this.lines[lineIndex].content = this.sanitizer.bypassSecurityTrustHtml(html);
    this.cdr.detectChanges();
    this.scrollToBottom();
  }

  private appendToLastError(data: string) {
    const lastLine = this.lines[this.lines.length - 1];
    if (lastLine && lastLine.type === 'error') {
      lastLine.content = (lastLine.content || '') + data;
      this.cdr.detectChanges();
    } else {
      this.addLine('error', data);
    }
  }

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
      .catch(() => {});
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

    const displayPath = pwd.replace(/\\/g, '/');
    const home = this.getHomePath();
    const shortPath =
      home && displayPath.startsWith(home) ? '~' + displayPath.slice(home.length) : displayPath;

    this.lastPwd = pwd;
    this.prompt = `${shortPath} $`;
    this.cdr.detectChanges();
  }

  private getHomePath(): string {
    const match = this.lastPwd.match(
      /^(\/[a-z]\/Users\/[^\/]+|\/home\/[^\/]+|C:\\Users\\[^\\/]+)/i,
    );
    if (match) {
      return match[1].replace(/\\/g, '/');
    }
    return '';
  }

  private updateLsCache(lsOutput: string) {
    this.autocompleteHelper.updateCache(lsOutput);
  }

  private loadSessionHistory(session: SessionData | null) {
    if (!session) {
      this.lines = [];
      this.historyHelper.setHistory([]);
      this.prompt = '$';
      this.lastPwd = '';
      this.cdr.detectChanges();
      return;
    }

    const newLines: TerminalLine[] = [];
    const commands: string[] = [];

    for (const entry of session.history) {
      const prompt = this.formatPrompt(entry.workingDirectory);
      newLines.push({
        type: 'command',
        content: `${prompt} ${entry.command}`,
        timestamp: entry.timestamp,
      });
      commands.push(entry.command);

      if (entry.output) {
        const html = this.ansiConverter.toHtml(entry.output);
        newLines.push({
          type: 'output',
          content: this.sanitizer.bypassSecurityTrustHtml(html),
          timestamp: entry.timestamp,
        });
      }

      if (entry.exitCode !== 0 && !entry.output) {
        newLines.push({
          type: 'error',
          content: `Program exited with code ${entry.exitCode}`,
          timestamp: entry.timestamp,
        });
      }
    }

    this.lines = newLines;
    this.historyHelper.setHistory(commands);
    if (session.history.length > 0) {
      const last = session.history[session.history.length - 1];
      this.updatePwd(last.workingDirectory);
    }
    this.cdr.detectChanges();
    this.scrollToBottom();
  }

  private formatPrompt(workingDirectory: string): string {
    const pwd = (workingDirectory || '').trim();
    if (!pwd) return '$';
    const displayPath = pwd.replace(/\\/g, '/');
    const home = this.getHomePathFromPath(displayPath);
    return home && displayPath.startsWith(home) ? `~${displayPath.slice(home.length)} $` : `${displayPath} $`;
  }

  private getHomePathFromPath(path: string): string {
    const match = path.match(/^(\/[a-z]\/Users\/[^\/]+|\/home\/[^\/]+|C:\/Users\/[^\/]+)/i);
    if (match) {
      return match[1];
    }
    return '';
  }

  // Wrapper for template
  classForPrefix(prefix: FilePrefix): string {
    return this.autocompleteHelper.getClassForPrefix(prefix);
  }

  private addLine(type: 'command' | 'output' | 'error' | 'info', content: string) {
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

    const result = this.autocompleteHelper.handleTab(this.currentCommand);
    this.currentCommand = result.newCommand;

    if (result.suggestions.length > 0) {
      this.showAutocompleteSuggestions(result.suggestions);
      this.scrollToBottom();
    }
  }

  private showAutocompleteSuggestions(candidates: LsEntry[]) {
    this.autocompleteSuggestions = candidates;
    this.cdr.detectChanges();
  }

  onInput() {
    this.autocompleteSuggestions = this.autocompleteHelper.getSuggestions(this.currentCommand);
    this.cdr.detectChanges();
  }

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
    this.currentCommand = this.historyHelper.navigate(direction, this.currentCommand);
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
