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
import { WebSocketService, CommandResponse } from '../../app/core/services/websocket.service';
import { Subscription } from 'rxjs';
import { HlmButtonImports } from '@ctfdeck/helm/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideServer, lucidePlus, lucideTrash2 } from '@ng-icons/lucide';

type FilePrefix = 'dir' | 'arc' | 'bin' | 'lnk' | 'txt' | 'img' | 'vid' | 'aud' | 'unk';

interface LsEntry {
  prefix: FilePrefix;
  name: string;
}

interface TerminalLine {
  type: 'command' | 'output' | 'error' | 'info' | 'ls';
  content: string;
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

  showServerSelection: boolean = false;
  serverUrl: string = '';
  savedServers: string[] = ['ws://localhost:42712', 'wss://echo.websocket.org'];

  private subscriptions: Subscription = new Subscription();
  private commandHistory: string[] = [];
  private historyIndex: number = -1;

  constructor(
    private wsService: WebSocketService,
    private cdr: ChangeDetectorRef,
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
      })
      .catch((err) => {
        this.addLine('error', `Connection failed: ${err?.message || 'Unknown error'}`);
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

    this.wsService
      .executeCommand(cmd)
      .then((response: CommandResponse) => {
        this.updatePwd(response.pwdOutput ?? '');
        this.updateLsCache(response.lsOutput ?? '');

        if (this.isPlainLsCommand(cmd)) {
          if (response.lsOutput) {
            this.addLsGrid(response.lsOutput);
          } else if (response.output) {
            this.addLine('output', response.output);
          }
        } else {
          if (response.output) {
            this.addLine('output', response.output);
          }
        }

        if (response.error) {
          this.addLine('error', response.error);
        }

        if (response.exitCode !== 0 && !response.error) {
          this.addLine('error', `Program exited with code ${response.exitCode}`);
        }

        this.scrollToBottom();
      })
      .catch((err) => {
        this.addLine('error', `Execution failed: ${err?.message || err}`);
      });
  }


  private updatePwd(pwdOutput: string) {
    const pwd = (pwdOutput || '').trim();
    if (!pwd) return;

    this.lastPwd = pwd;
    this.prompt = `${pwd} $`;
    this.cdr.detectChanges();
  }


  private updateLsCache(lsOutput: string) {
    this.lastLsEntries = this.parseLs(lsOutput);
  }

  private parseLs(lsOutput: string): LsEntry[] {
    const lines = (lsOutput || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const out: LsEntry[] = [];
    for (const line of lines) {
      const m = line.match(/^\[(dir|arc|bin|lnk|txt|img|vid|aud|unk)\]\s+(.+)$/i);
      if (!m) continue;
      out.push({
        prefix: m[1].toLowerCase() as FilePrefix,
        name: m[2],
      });
    }
    return out;
  }

  classForPrefix(prefix: FilePrefix): string {
    switch (prefix) {
      case 'dir': return 'ft-dir';
      case 'arc': return 'ft-arc';
      case 'bin': return 'ft-bin';
      case 'lnk': return 'ft-lnk';
      case 'txt': return 'ft-txt';
      case 'img': return 'ft-img';
      case 'vid': return 'ft-vid';
      case 'aud': return 'ft-aud';
      default: return 'ft-unk';
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

  private isPlainLsCommand(cmd: string): boolean {
    const trimmed = cmd.trim();
    if (!trimmed) return false;

    const parts = trimmed.split(/\s+/);
    const base = (parts[0] || '').toLowerCase();

    return (base === 'ls' || base === 'dir') && parts.length === 1;
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

    this.addLine('info', candidates.join('    '));
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
    this.lines.push({
      type,
      content,
      timestamp: new Date(),
    });
    this.cdr.detectChanges();
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
