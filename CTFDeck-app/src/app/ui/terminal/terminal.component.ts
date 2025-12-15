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
import { WebSocketService, CommandResponse } from '../../core/services/websocket.service';
import { Subscription } from 'rxjs';

interface TerminalLine {
  type: 'command' | 'output' | 'error' | 'info';
  content: string;
  timestamp: Date;
}

@Component({
  selector: 'app-terminal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './terminal.component.html',
  styleUrls: ['./terminal.component.css'],
})
export class TerminalComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;
  @ViewChild('commandInput') private commandInput!: ElementRef;

  lines: TerminalLine[] = [];
  currentCommand: string = '';
  isConnected: boolean = false;

  private subscriptions: Subscription = new Subscription();
  private commandHistory: string[] = [];
  private historyIndex: number = -1;

  constructor(
    private wsService: WebSocketService,
    private cdr: ChangeDetectorRef,
  ) {}

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
    this.scrollToBottom();
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
      this.scrollContainer.nativeElement.scrollTop =
        this.scrollContainer.nativeElement.scrollHeight;
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

  focusInput() {
    this.commandInput.nativeElement.focus();
  }
}
