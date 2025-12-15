import { Injectable, NgZone } from '@angular/core';
import { Subject, Observable, BehaviorSubject } from 'rxjs';
import {
  serializeCommand,
  deserializeResponse,
  generateUUID,
  CommandResponse,
} from './websocket.protocol';

export type { CommandResponse };

export interface TerminalMessage {
  type: 'command' | 'response' | 'error' | 'info';
  content: string;
  exitCode?: number;
}

@Injectable({
  providedIn: 'root',
})
export class WebSocketService {
  private ws: WebSocket | null = null;
  private isConnectedSubject = new BehaviorSubject<boolean>(false);
  public isConnected$ = this.isConnectedSubject.asObservable();

  private pendingCommands = new Map<
    string,
    {
      resolve: (value: CommandResponse | PromiseLike<CommandResponse>) => void;
      reject: (reason?: any) => void;
    }
  >();

  private messagesSubject = new Subject<TerminalMessage>();
  public messages$ = this.messagesSubject.asObservable();

  constructor(private ngZone: NgZone) {}

  connect(url: string = 'ws://localhost:42712'): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        if (this.ws) {
          this.ws.close();
        }

        this.ws = new WebSocket(url);
        this.ws.binaryType = 'arraybuffer'; // IMPORTANT for binary protocol

        this.ws.onopen = () => {
          this.ngZone.run(() => {
            this.isConnectedSubject.next(true);
            this.messagesSubject.next({ type: 'info', content: `Connected to ${url}` });
            resolve();
          });
        };

        this.ws.onclose = () => {
          this.ngZone.run(() => {
            this.isConnectedSubject.next(false);
            this.messagesSubject.next({ type: 'info', content: 'Disconnected from server' });
            this.cleanup();
          });
        };

        this.ws.onerror = (error) => {
          this.ngZone.run(() => {
            this.messagesSubject.next({ type: 'error', content: 'WebSocket connection error' });
            console.error('WebSocket error:', error);
            if (!this.isConnectedSubject.value) {
              reject(error);
            }
          });
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.cleanup();
  }

  private handleMessage(data: ArrayBuffer) {
    try {
      const response = deserializeResponse(data);

      const pending = this.pendingCommands.get(response.messageId);
      if (pending) {
        this.ngZone.run(() => {
          pending.resolve(response);
        });
        this.pendingCommands.delete(response.messageId);
      } else {
        console.warn('Received response for unknown message ID:', response.messageId);
      }
    } catch (error) {
      console.error('Error parsing binary response:', error);
      this.ngZone.run(() => {
        this.messagesSubject.next({
          type: 'error',
          content: `Protocol Error: Failed to parse server response`,
        });
      });
    }
  }

  executeCommand(command: string): Promise<CommandResponse> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('WebSocket is not connected'));
    }

    return new Promise<CommandResponse>((resolve, reject) => {
      const messageId = generateUUID();

      try {
        const serialized = serializeCommand(command, messageId);

        // set timeout
        const timeoutId = setTimeout(() => {
          if (this.pendingCommands.has(messageId)) {
            this.pendingCommands.delete(messageId);
            reject(new Error('Command timeout'));
          }
        }, 30000);

        this.pendingCommands.set(messageId, {
          resolve: (res) => {
            clearTimeout(timeoutId);
            resolve(res);
          },
          reject: (err) => {
            clearTimeout(timeoutId);
            reject(err);
          },
        });

        if (!this.ws) {
          reject(new Error('WebSocket is not connected, check the URL'));
          return;
        }
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(serialized);
        }
      } catch (error) {
        this.pendingCommands.delete(messageId);
        reject(error);
      }
    });
  }

  private cleanup() {
    this.pendingCommands.forEach((p) => p.reject(new Error('Connection closed')));
    this.pendingCommands.clear();
  }
}
