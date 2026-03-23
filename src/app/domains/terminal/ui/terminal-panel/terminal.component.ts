import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { toast } from 'ngx-sonner';
import AnsiToHtml from 'ansi-to-html';

import { HlmButtonImports } from '@ctfdeck/helm/button';
import { HlmDialogImports } from '@ctfdeck/helm/dialog';
import { HlmIconImports } from '@ctfdeck/helm/icon';
import { HlmInputImports } from '@ctfdeck/helm/input';
import { HlmLabelImports } from '@ctfdeck/helm/label';
import { HlmMenuImports, HlmSubMenu } from '@ctfdeck/helm/menu';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideClock3,
  lucideCopy,
  lucideFileText,
  lucideFolderOpen,
  lucideGlobe,
  lucideMoreHorizontal,
  lucidePlus,
  lucideSave,
  lucideServer,
  lucideSettings,
  lucideTerminal,
  lucideTrash2,
  lucideX,
  lucideZap,
} from '@ng-icons/lucide';
import { BrnDialogClose, BrnDialogContent, BrnDialogTrigger } from '@spartan-ng/brain/dialog';
import { BrnMenuTrigger } from '@spartan-ng/brain/menu';

import { WebSocketService } from '../../../../infrastructure/transport/websocket/websocket.service';
import type { FilePrefix } from '../../models/file-prefix.type';
import type { LsEntry } from '../../models/ls-entry.model';
import type { TerminalLine } from '../../models/terminal-line.model';
import { TerminalAutocomplete } from '../../utils/terminal-autocomplete.utils';
import { TerminalHistory } from '../../utils/terminal-history.utils';
import {
  formatPromptFromPath,
  formatPromptFromWorkingDirectory,
  looksLikeDirectoryChange,
  looksLikeDirectoryListing,
} from '../../utils/terminal-path.utils';
import { SessionStore } from '../../../sessions/state/session.store';
import type { SessionData } from '../../../sessions/models/session-data.model';
import { WriteUpStore } from '../../../writeups/state/writeup.store';
import { WriteUpClientService } from '../../../writeups/infrastructure/writeup-client.service';
import type { WriteUpMetadata } from '../../../writeups/models/writeup.model';
import { TranslatePipe } from '../../../../shell/menubar/translate.pipe';
import { I18nService } from '../../../../shell/menubar/i18n.service';
import { DEFAULT_CHAT_NAME } from '../../../../shared/constants/default-item-names.constants';

interface MenuTriggerLike {
  open(): void;
  close?(): void;
}

interface BrnMenuTriggerInternals {
  _cdkTrigger?: MenuTriggerLike;
  menuTrigger?: MenuTriggerLike;
  _menuTrigger?: MenuTriggerLike;
  open?(): void;
}

@Component({
  selector: 'app-terminal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NgIcon,
    ...HlmIconImports,
    HlmButtonImports,
    BrnMenuTrigger,
    ...HlmMenuImports,
    HlmSubMenu,
    ...HlmInputImports,
    ...HlmLabelImports,
    ...HlmDialogImports,
    BrnDialogTrigger,
    BrnDialogContent,
    BrnDialogClose,
    TranslatePipe,
  ],
  providers: [
    provideIcons({
      lucideClock3,
      lucideServer,
      lucidePlus,
      lucideTrash2,
      lucideFileText,
      lucideFolderOpen,
      lucideSettings,
      lucideX,
      lucideSave,
      lucideZap,
      lucideGlobe,
      lucideTerminal,
      lucideCopy,
      lucideMoreHorizontal,
    }),
  ],
  templateUrl: './terminal.component.html',
  styleUrls: ['./terminal.component.css'],
})
export class TerminalComponent implements OnInit, OnDestroy {
  private static readonly MAX_AUTO_CHAT_NAME_LENGTH = 60;
  private static readonly MAX_CHAT_TITLE_LENGTH = 32;

  private readonly wsService = inject(WebSocketService);
  private readonly sessionStore = inject(SessionStore);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly sanitizer = inject(DomSanitizer);
  readonly i18n = inject(I18nService);

  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;
  @ViewChild('commandInput') private commandInput!: ElementRef<HTMLInputElement>;
  @ViewChild('selectionTrigger', { read: BrnMenuTrigger })
  private selectionTrigger?: BrnMenuTrigger;

  lines: TerminalLine[] = [];
  currentCommand = '';
  isConnected = false;
  chatName = '';

  prompt = '$';
  private lastPwd = '';

  autocompleteSuggestions: LsEntry[] = [];

  serverUrl = '';
  savedServers: string[] = ['ws://localhost:42712', 'wss://echo.websocket.org'];
  isSessionLoading = false;

  selectedText = '';
  selectionMenuPosition = { x: 0, y: 0 };

  writeUps$ = inject(WriteUpStore).allWriteUps$;
  private allWriteUps: WriteUpMetadata[] = [];

  private readonly subscriptions = new Subscription();
  private readonly history = new TerminalHistory();
  public readonly autocomplete = new TerminalAutocomplete();
  private activeSession: SessionData | null = null;
  private chatNameSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private suppressChatNameChangeHandler = false;

  private readonly writeUpStore = inject(WriteUpStore);
  private readonly writeUpClientService = inject(WriteUpClientService);

  private readonly ansiConverter = new AnsiToHtml({
    fg: '#d4d4d4',
    bg: '#1e1e1e',
    newline: true,
    colors: {
      4: '#61afef',
      34: '#61afef',
    },
  });
  private lineCounter = 0;

  constructor() {
    this.serverUrl = this.wsService.getUrl();
  }

  ngOnInit(): void {
    this.subscriptions.add(
      this.wsService.isConnected$.subscribe((connected) => {
        this.isConnected = connected;
        if (!connected) {
          this.addLine('info', this.i18n.translate('terminal.log.disconnected'));
        }
      }),
    );

    this.subscriptions.add(
      this.sessionStore.activeSession$.subscribe((session) => {
        this.activeSession = session;
        this.suppressChatNameChangeHandler = true;
        this.chatName = session?.name ?? '';
        this.suppressChatNameChangeHandler = false;
        this.loadSessionHistory(session);
      }),
    );

    this.subscriptions.add(
      this.sessionStore.terminalEvents$.subscribe((event) => {
        this.addLine(event.type, event.content);
      }),
    );

    this.subscriptions.add(
      this.sessionStore.isLoading$.subscribe((loading) => {
        this.isSessionLoading = loading;
      }),
    );

    this.subscriptions.add(
      this.writeUps$.subscribe((writeUps) => {
        this.allWriteUps = writeUps;
      }),
    );

    void this.writeUpStore.refreshAllWriteUps(0, 6, false);
    this.connect();
  }

  ngOnDestroy(): void {
    if (this.chatNameSaveTimer) {
      clearTimeout(this.chatNameSaveTimer);
    }

    this.subscriptions.unsubscribe();
  }

  async executeCommand(): Promise<void> {
    const cmd = this.currentCommand.trim();

    if (!cmd) {
      return;
    }

    this.history.add(cmd);
    this.addLine('command', `${this.prompt} ${cmd}`);
    this.currentCommand = '';
    this.clearAutocompleteSuggestions();

    if (cmd === 'clear' || cmd === 'cls') {
      this.lines = [];
      return;
    }

    if (cmd === 'connect') {
      this.addLine('info', this.i18n.translate('terminal.log.connecting'));
      this.connect();
      return;
    }

    if (cmd === 'disconnect') {
      this.addLine('info', this.i18n.translate('terminal.log.disconnecting'));
      this.wsService.disconnect();
      return;
    }

    if (!this.isConnected) {
      this.addLine('error', this.i18n.translate('terminal.log.notConnected'));
      return;
    }

    if (this.isSessionLoading) {
      this.addLine('info', this.i18n.translate('terminal.log.sessionLoading'));
      return;
    }

    try {
      await this.sessionStore.ensureActiveSession();
      await this.autoRenameChatFromFirstCommand(cmd);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.addLine('error', `Session error: ${message}`);
      return;
    }

    let outputLineIndex = -1;
    let outputBuffer = '';
    let errorBuffer = '';
    let pendingRender = false;
    let lastRenderTime = 0;
    const minRenderInterval = 16;

    const scheduleRender = () => {
      if (pendingRender) {
        return;
      }

      const now = performance.now();

      if (now - lastRenderTime < minRenderInterval) {
        pendingRender = true;

        requestAnimationFrame(() => {
          pendingRender = false;
          lastRenderTime = performance.now();
          this.renderOutputBuffer(outputLineIndex, outputBuffer);
        });

        return;
      }

      lastRenderTime = now;
      this.renderOutputBuffer(outputLineIndex, outputBuffer);
    };

    this.wsService
      .executeCommandStreaming(
        cmd,
        (data: string) => {
          outputBuffer += data;

          if (outputLineIndex === -1) {
            outputLineIndex = this.lines.length;
            this.lines.push({
              id: this.nextLineId('live-output'),
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

        if (looksLikeDirectoryListing(cmd)) {
          this.updateLsCache(outputBuffer);
        }

        if (result.workingDirectory) {
          this.updatePwd(result.workingDirectory);
        }

        if (result.exitCode !== 0 && !errorBuffer) {
          this.addLine('error', `Program exited with code ${result.exitCode}`);
        }

        if (looksLikeDirectoryChange(cmd)) {
          this.refreshAutocompleteCache();
        }

        this.scrollToBottom();
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.addLine('error', `Execution failed: ${message}`);
      });
  }

  onTabAutocomplete(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    keyboardEvent.preventDefault();

    const result = this.autocomplete.handleTab(this.currentCommand);
    this.currentCommand = result.newCommand;

    if (result.suggestions.length > 0) {
      this.showAutocompleteSuggestions(result.suggestions);
      this.scrollToBottom();
      return;
    }

    this.clearAutocompleteSuggestions();
  }

  onInput(): void {
    this.autocompleteSuggestions = this.autocomplete.getSuggestions(this.currentCommand);
    this.cdr.detectChanges();
  }

  onChatNameChange(): void {
    if (this.suppressChatNameChangeHandler) {
      return;
    }

    if (this.chatName.length > TerminalComponent.MAX_CHAT_TITLE_LENGTH) {
      this.chatName = this.chatName.slice(0, TerminalComponent.MAX_CHAT_TITLE_LENGTH);
    }

    this.scheduleChatRename();
  }

  onChatNameBlur(): void {
    this.flushChatRename();
  }

  clearAutocompleteSuggestions(): void {
    if (this.autocompleteSuggestions.length > 0) {
      this.autocompleteSuggestions = [];
      this.cdr.detectChanges();
    }
  }

  navigateHistory(direction: 'up' | 'down', event: Event): void {
    event.preventDefault();
    this.currentCommand = this.history.navigate(direction, this.currentCommand);
  }

  onContainerEnter(event: Event): void {
    if (!(event instanceof KeyboardEvent) || this.shouldIgnoreContainerKey(event)) {
      return;
    }

    this.focusInput(event);
  }

  onContainerSpace(event: Event): void {
    if (!(event instanceof KeyboardEvent) || this.shouldIgnoreContainerKey(event)) {
      return;
    }

    event.preventDefault();
    this.focusInput(event);
  }

  onHeaderEnter(event: Event): void {
    if (!(event instanceof KeyboardEvent) || this.isTypingTarget(event.target)) {
      return;
    }

    event.stopPropagation();
  }

  onHeaderSpace(event: Event): void {
    if (!(event instanceof KeyboardEvent) || this.isTypingTarget(event.target)) {
      return;
    }

    event.stopPropagation();
    event.preventDefault();
  }

  focusInput(event?: Event): void {
    const selection = window.getSelection();

    if (selection && selection.toString().length > 0) {
      return;
    }

    if (event && event.target instanceof HTMLElement) {
      const tag = event.target.tagName.toLowerCase();
      if (tag === 'input' || tag === 'button' || tag === 'textarea' || tag === 'select') {
        return;
      }
    }

    this.commandInput?.nativeElement?.focus();
  }

  reconnect(): void {
    this.wsService.disconnect();
    this.wsService.setUrl(this.serverUrl);
    this.connect();
  }

  saveServer(): void {
    if (this.serverUrl && !this.savedServers.includes(this.serverUrl)) {
      this.savedServers.push(this.serverUrl);
    }
  }

  removeServer(url: string, event: Event): void {
    event.stopPropagation();
    this.savedServers = this.savedServers.filter((server) => server !== url);
  }

  selectServer(url: string): void {
    this.serverUrl = url;
    this.reconnect();
  }

  onMouseDown(event: MouseEvent): void {
    if (event.button === 0) {
      this.dismissSelection();
    }
  }

  onMouseUp(event: MouseEvent): void {
    if (event.button !== 0) {
      return;
    }

    const selection = window.getSelection();

    if (!selection || selection.isCollapsed) {
      if (this.selectedText) {
        this.dismissSelection();
      }
      return;
    }

    const text = selection.toString().trim();

    if (text.length >= 2) {
      this.selectedText = text;
    }
  }

  onContextMenu(event: MouseEvent): void {
    void this.writeUpStore.refreshAllWriteUps(0, 6, false);

    const selection = window.getSelection();
    const currentText = selection?.toString().trim();

    if (currentText && currentText.length >= 2) {
      this.selectedText = currentText;
    }

    if (this.selectedText && this.selectedText.length >= 2) {
      event.preventDefault();

      this.selectionMenuPosition = {
        x: event.clientX,
        y: event.clientY,
      };

      this.cdr.detectChanges();

      setTimeout(() => {
        if (!this.selectionTrigger) {
          return;
        }

        try {
          const internals = this.selectionTrigger as unknown as BrnMenuTriggerInternals;
          const trigger =
            internals._cdkTrigger || internals.menuTrigger || internals._menuTrigger;

          if (trigger) {
            trigger.open();
            return;
          }

          if (typeof internals.open === 'function') {
            internals.open();
          }
        } catch (error: unknown) {
          console.error('Failed to open selection menu', error);
        }
      }, 5);
    }
  }

  dismissSelection(): void {
    this.selectedText = '';
    const internals = this.selectionTrigger as unknown as BrnMenuTriggerInternals;
    internals._cdkTrigger?.close?.();

    try {
      window.getSelection()?.removeAllRanges();
    } catch { /* Ignore */ }
  }

  copySelection(): void {
    if (!this.selectedText) {
      return;
    }

    navigator.clipboard.writeText(this.selectedText).then(() => { /* Ignore */ });
    toast.success('Copied to clipboard');
    this.dismissSelection();
  }

  async appendToWriteUp(writeUp: WriteUpMetadata): Promise<void> {
    await this.appendSelectionToWriteUpById(writeUp.id, writeUp.name);
  }

  hasProjectContext(): boolean {
    return Boolean(this.activeSession?.projectId);
  }

  async addToRecentWriteUpQuick(): Promise<void> {
    if (!this.selectedText) {
      return;
    }

    await this.writeUpStore.refreshAllWriteUps(0, 6, false);

    const recent = this.pickMostRecentWriteUp(this.allWriteUps);
    if (recent) {
      await this.appendSelectionToWriteUpById(recent.id, recent.name);
      return;
    }

    const created = await this.createQuickWriteUp(this.i18n.translate('terminal.writeup.quick.recentName'));
    if (created) {
      await this.appendSelectionToWriteUpById(created.id, created.name);
    }
  }

  async addToProjectWriteUpQuick(): Promise<void> {
    if (!this.selectedText || !this.activeSession?.projectId) {
      return;
    }

    await this.writeUpStore.refreshAllWriteUps(0, 6, false);

    const projectWriteUps = this.allWriteUps.filter(
      (writeUp) => writeUp.projectId === this.activeSession?.projectId,
    );
    const recentProject = this.pickMostRecentWriteUp(projectWriteUps);

    if (recentProject) {
      await this.appendSelectionToWriteUpById(recentProject.id, recentProject.name);
      return;
    }

    const created = await this.createQuickWriteUp(this.i18n.translate('terminal.writeup.quick.projectName'));
    if (created) {
      await this.appendSelectionToWriteUpById(created.id, created.name);
    }
  }

  classForPrefix(prefix: FilePrefix): string {
    return this.autocomplete.getClassForPrefix(prefix);
  }

  private connect(): void {
    if (this.wsService.isConnected$.value) {
      this.addLine('info', this.i18n.translate('terminal.log.connected'));
      this.addLine('info', this.i18n.translate('terminal.log.helpHint'));
      this.scrollToBottom();
      this.initializeTerminalState();
      return;
    }

    this.wsService
      .connect()
      .then(() => {
        this.addLine('info', this.i18n.translate('terminal.log.connected'));
        this.addLine('info', this.i18n.translate('terminal.log.helpHint'));
        this.scrollToBottom();
        this.initializeTerminalState();
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unknown error';
        this.addLine('error', `Connection failed: ${message}`);
      });
  }

  private initializeTerminalState(): void {
    this.wsService
      .executeCommandStreaming(
        'pwd',
        () => { /* Ignore */ },
        () => { /* Ignore */ },
      )
      .then((result) => {
        if (result.workingDirectory) {
          this.updatePwd(result.workingDirectory);
        }
        this.refreshAutocompleteCache();
      })
      .catch(() => { /* Ignore */ });
  }

  private renderOutputBuffer(lineIndex: number, buffer: string): void {
    if (lineIndex < 0 || lineIndex >= this.lines.length) {
      return;
    }

    const html = this.ansiConverter.toHtml(buffer);
    this.lines[lineIndex].content = this.sanitizer.bypassSecurityTrustHtml(html);
    this.cdr.detectChanges();
    this.scrollToBottom();
  }

  private appendToLastError(data: string): void {
    const lastLine = this.lines[this.lines.length - 1];

    if (lastLine && lastLine.type === 'error') {
      lastLine.content = `${lastLine.content || ''}${data}`;
      this.cdr.detectChanges();
      return;
    }

    this.addLine('error', data);
  }

  private refreshAutocompleteCache(): void {
    let output = '';

    this.wsService
      .executeCommandStreaming(
        'ls',
        (data) => { output += data; },
        () => { /* Ignore */ },
      )
      .then(() => {
        if (output) {
          this.updateLsCache(output);
        }
      })
      .catch(() => { /* Ignore */ });
  }

  private updatePwd(workingDirectory: string): void {
    const pwd = (workingDirectory || '').trim();

    if (!pwd) {
      return;
    }

    this.lastPwd = pwd;
    this.prompt = formatPromptFromWorkingDirectory(pwd);
    this.cdr.detectChanges();
  }

  private updateLsCache(lsOutput: string): void {
    this.autocomplete.updateCache(lsOutput);
  }

  private async autoRenameChatFromFirstCommand(command: string): Promise<void> {
    const activeSessionId = this.sessionStore.getActiveSessionId();
    if (!activeSessionId) {
      return;
    }

    let session = this.activeSession;
    if (!session || session.id !== activeSessionId) {
      session = await this.sessionStore.getSessionData(activeSessionId);
      this.activeSession = session;
    }

    if (!session || !this.isDefaultChatName(session.name) || session.history.length > 0) {
      return;
    }

    const nextName = this.buildChatNameFromCommand(command);
    if (!nextName || nextName === session.name.trim()) {
      return;
    }

    try {
      await this.sessionStore.renameSession(session.id, nextName, session.description || '');
      this.activeSession = {
        ...session,
        name: nextName,
      };
      this.chatName = nextName;
    } catch (error: unknown) {
      console.warn('Auto-rename chat failed:', error);
    }
  }

  private isDefaultChatName(name: string): boolean {
    return name.trim().toLowerCase() === DEFAULT_CHAT_NAME.toLowerCase();
  }

  private buildChatNameFromCommand(command: string): string {
    const normalized = command.replace(/\s+/g, ' ').trim();
    if (!normalized) {
      return '';
    }

    return normalized.slice(0, TerminalComponent.MAX_AUTO_CHAT_NAME_LENGTH).trim();
  }

  private loadSessionHistory(session: SessionData | null): void {
    if (!session) {
      this.lines = [];
      this.history.setHistory([]);
      this.prompt = '$';
      this.lastPwd = '';
      this.cdr.detectChanges();
      return;
    }

    const newLines: TerminalLine[] = [];
    const commands: string[] = [];

    for (const entry of session.history) {
      const prompt = formatPromptFromPath(entry.workingDirectory);

      const ts = new Date(entry.timestamp).getTime();

      newLines.push({
        id: `history-${ts}-cmd-${commands.length}`,
        type: 'command',
        content: `${prompt} ${entry.command}`,
        timestamp: entry.timestamp,
      });

      commands.push(entry.command);

      if (entry.output) {
        const html = this.ansiConverter.toHtml(entry.output);
        newLines.push({
          id: `history-${ts}-out-${commands.length}`,
          type: 'output',
          content: this.sanitizer.bypassSecurityTrustHtml(html),
          timestamp: entry.timestamp,
        });
      }

      if (entry.exitCode !== 0 && !entry.output) {
        newLines.push({
          id: `history-${ts}-err-${commands.length}`,
          type: 'error',
          content: `Program exited with code ${entry.exitCode}`,
          timestamp: entry.timestamp,
        });
      }
    }

    this.lines = newLines;
    this.history.setHistory(commands);

    if (session.history.length > 0) {
      const last = session.history[session.history.length - 1];
      this.updatePwd(last.workingDirectory);
    }

    this.cdr.detectChanges();
    this.scrollToBottom();
  }

  private addLine(type: 'command' | 'output' | 'error' | 'info', content: string): void {
    let renderedContent: SafeHtml | string = content;

    if (type === 'output') {
      const html = this.ansiConverter.toHtml(content);
      renderedContent = this.sanitizer.bypassSecurityTrustHtml(html);
    }

    this.lines.push({
      id: this.nextLineId(type),
      type,
      content: renderedContent,
      timestamp: new Date(),
    });

    this.cdr.detectChanges();
  }

  private showAutocompleteSuggestions(candidates: LsEntry[]): void {
    this.autocompleteSuggestions = candidates;
    this.cdr.detectChanges();
  }

  private shouldIgnoreContainerKey(event: KeyboardEvent): boolean {
    if (event.defaultPrevented) {
      return true;
    }

    if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing) {
      return true;
    }

    return this.isTypingTarget(event.target);
  }

  private isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    if (target.isContentEditable) {
      return true;
    }

    return Boolean(target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]'));
  }

  private scrollToBottom(): void {
    try {
      this.commandInput.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
    } catch { /* Ignore */ }
  }

  private scheduleChatRename(): void {
    if (this.chatNameSaveTimer) {
      clearTimeout(this.chatNameSaveTimer);
    }

    this.chatNameSaveTimer = setTimeout(() => {
      this.flushChatRename();
    }, 350);
  }

  private flushChatRename(): void {
    if (!this.activeSession) {
      return;
    }

    if (this.chatNameSaveTimer) {
      clearTimeout(this.chatNameSaveTimer);
      this.chatNameSaveTimer = null;
    }

    const trimmed = this.chatName.trim().slice(0, TerminalComponent.MAX_CHAT_TITLE_LENGTH);
    const fallbackName = this.activeSession.name || 'Chat';
    const nextName = trimmed || fallbackName;

    if (nextName === this.activeSession.name) {
      this.chatName = nextName;
      return;
    }

    this.chatName = nextName;
    void this.sessionStore.renameSession(
      this.activeSession.id,
      nextName,
      this.activeSession.description || '',
    );
  }

  private nextLineId(prefix: string): string {
    this.lineCounter += 1;
    return `${prefix}-${this.lineCounter}`;
  }

  private async appendSelectionToWriteUpById(writeUpId: string, writeUpName: string): Promise<void> {
    const selectedText = this.selectedText;
    if (!selectedText) {
      return;
    }

    try {
      const { success, writeUp: fullWriteUp } = await this.writeUpClientService.load(writeUpId);

      if (!success || !fullWriteUp) {
        toast.error(this.i18n.translate('terminal.writeup.quick.error'), {
          description: this.i18n.translate('terminal.writeup.quick.loadError'),
        });
        return;
      }

      const appended = `\n\n\`\`\`bash\n${selectedText}\n\`\`\`\n`;
      const newContent = fullWriteUp.content + appended;
      const updated = await this.writeUpClientService.update(writeUpId, fullWriteUp.name, newContent);

      if (!updated) {
        toast.error(this.i18n.translate('terminal.writeup.quick.error'), {
          description: this.i18n.translate('terminal.writeup.quick.updateError'),
        });
        return;
      }

      toast.success(this.i18n.translate('terminal.writeup.quick.success'), {
        description: `"${selectedText.slice(0, 60)}${selectedText.length > 60 ? '...' : ''}" -> "${writeUpName}"`,
      });

      this.dismissSelection();
      this.selectedText = '';
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : this.i18n.translate('terminal.writeup.quick.unknown');
      toast.error(this.i18n.translate('terminal.writeup.quick.error'), {
        description: message,
      });
    }
  }

  private pickMostRecentWriteUp(writeUps: WriteUpMetadata[]): WriteUpMetadata | null {
    if (!writeUps.length) {
      return null;
    }

    return [...writeUps].sort((a, b) => {
      const aTime = new Date(a.updatedAt).getTime();
      const bTime = new Date(b.updatedAt).getTime();
      return bTime - aTime;
    })[0] ?? null;
  }

  private async createQuickWriteUp(name: string): Promise<{ id: string; name: string } | null> {
    try {
      const sessionId = await this.sessionStore.ensureActiveSession();
      const safeName = name.trim().slice(0, 32) || this.i18n.translate('terminal.writeup.quick.defaultName');
      const created = await this.writeUpClientService.create(sessionId, safeName);

      if (!created.success || !created.writeUpId) {
        toast.error(this.i18n.translate('terminal.writeup.quick.error'), {
          description: this.i18n.translate('terminal.writeup.quick.createError'),
        });
        return null;
      }

      await this.writeUpStore.refreshAllWriteUps(0, 6, false);
      return { id: created.writeUpId, name: safeName };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : this.i18n.translate('terminal.writeup.quick.unknown');
      toast.error(this.i18n.translate('terminal.writeup.quick.error'), {
        description: message,
      });
      return null;
    }
  }
}
