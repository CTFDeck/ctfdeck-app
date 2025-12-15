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

interface TerminalLine {
  type: 'command' | 'output' | 'error' | 'info';
  content: string;
  timestamp: Date;
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
  @ViewChild('commandInput') private commandInput!: ElementRef;

  lines: TerminalLine[] = [];
  currentCommand: string = '';
  isConnected: boolean = false;

  // Server Selection State
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
    // Subscribe to connection status
    this.subscriptions.add(
      this.wsService.isConnected$.subscribe((connected) => {
        this.isConnected = connected;
        if (!connected) {
          this.addLine('info', 'Disconnected from server.');
        }
      }),
    );

    // Initial connection
    this.connect();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.wsService.disconnect();
  }

  ngAfterViewChecked(): void {
    // Removed auto-scroll on every check to allow manual scrolling and history reading
  }

  private connect() {
    this.wsService
      .connect()
      .then(() => {
        this.addLine('info', 'Connected to WebSocket server.');
        this.addLine('info', 'Type "help" for a list of available commands or just type away!');
      })
      .catch((err) => {
        this.addLine('error', `Connection failed: ${err.message || 'Unknown error'}`);
      });
  }

  executeCommand() {
    const cmd = this.currentCommand.trim();
    if (!cmd) return;

    // Add to history
    this.commandHistory.push(cmd);
    this.historyIndex = this.commandHistory.length;

    // Display command
    this.addLine('command', `$ ${cmd}`);
    this.currentCommand = '';

    // Handle local commands
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

    // Execute via WebSocket
    this.wsService
      .executeCommand(cmd)
      .then((response: CommandResponse) => {
        if (response.output) {
          this.addLine('output', response.output);
        }
        if (response.error) {
          this.addLine('error', response.error);
        }
        if (response.exitCode !== 0 && !response.error) {
          this.addLine('error', `Program exited with code ${response.exitCode}`);
        }
      })
      .catch((err) => {
        this.addLine('error', `Execution failed: ${err.message}`);
      });
  }

  private addLine(type: 'command' | 'output' | 'error' | 'info', content: string) {
    console.log('[DEBUG addLine]', type, content);
    this.lines.push({
      type,
      content,
      timestamp: new Date(),
    });
    this.cdr.detectChanges();
  }

  private scrollToBottom(): void {
    try {
      // Use scrollIntoView on the input to ensure the bottom-most active element is visible
      // Using 'block: nearest' or 'end' prevents unnecessary jumping if already visible
      this.commandInput.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
    } catch (err) {}
  }

  // History navigation
  navigateHistory(direction: 'up' | 'down', event: Event) {
    event.preventDefault(); // Prevent cursor moving to start/end

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
    if (selection && selection.toString().length > 0) {
      return;
    }
    // Prevent stealing focus if user is interacting with inputs or buttons
    if (event && event.target instanceof HTMLElement) {
      const tag = event.target.tagName.toLowerCase();
      if (tag === 'input' || tag === 'button' || tag === 'textarea') {
        return;
      }
    }

    this.commandInput.nativeElement.focus();
  }

  reconnect() {
    this.wsService.disconnect();
    this.wsService.setUrl(this.serverUrl);
    this.connect();
  }

  saveServer() {
    if (this.serverUrl && !this.savedServers.includes(this.serverUrl)) {
      this.savedServers.push(this.serverUrl);
      // TODO: Save this to a database for the user configuration
      // e.g., this.configService.saveUserConfig({ key: 'saved_ws_servers', value: this.savedServers })
    }
  }

  removeServer(url: string, event: Event) {
    event.stopPropagation();
    this.savedServers = this.savedServers.filter((s) => s !== url);
    // TODO: Update database
  }

  selectServer(url: string) {
    this.serverUrl = url;
    this.reconnect();
  }
}
