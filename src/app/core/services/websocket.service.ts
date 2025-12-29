import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  serializeCommand,
  deserializeResponse,
  generateUUID,
  CommandResponse,
} from './websocket.protocol';

@Injectable({ providedIn: 'root' })
export class WebSocketService {
  private ws: WebSocket | null = null;

  private isConnectedSubject = new BehaviorSubject<boolean>(false);
  public isConnected$ = this.isConnectedSubject.asObservable();

  private pending = new Map<
    string,
    {
      resolve: (r: CommandResponse) => void;
      reject: (e: unknown) => void;
      timeoutId: ReturnType<typeof setTimeout>;
    }
  >();

  private currentUrl = 'ws://localhost:42712';

  constructor(private zone: NgZone) {}

  setUrl(url: string) {
    this.currentUrl = url;
  }

  getUrl(): string {
    return this.currentUrl;
  }

  connect(url?: string): Promise<void> {
    const target = url ?? this.currentUrl;
    this.currentUrl = target;

    return new Promise((resolve, reject) => {
      try {
        // Close existing socket if any
        if (this.ws) {
          try {
            this.ws.onopen = null;
            this.ws.onclose = null;
            this.ws.onerror = null;
            this.ws.onmessage = null;
            this.ws.close();
          } catch {}
          this.ws = null;
        }

        const ws = new WebSocket(target);
        ws.binaryType = 'arraybuffer';
        this.ws = ws;

        ws.onopen = () => {
          this.zone.run(() => {
            this.isConnectedSubject.next(true);
            resolve();
          });
        };

        ws.onmessage = (event) => {
          // data is ArrayBuffer because binaryType='arraybuffer'
          this.handleMessage(event.data as ArrayBuffer);
        };

        ws.onerror = (err) => {
          this.zone.run(() => {
            // If never connected, reject connect()
            if (!this.isConnectedSubject.value) reject(err);
          });
        };

        ws.onclose = () => {
          this.zone.run(() => {
            this.isConnectedSubject.next(false);
            this.rejectAllPending(new Error('Connection closed'));
          });
        };
      } catch (e) {
        reject(e);
      }
    });
  }

  disconnect(): void {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.zone.run(() => {
      this.isConnectedSubject.next(false);
      this.rejectAllPending(new Error('Disconnected'));
    });
  }

  executeCommand(command: string): Promise<CommandResponse> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('WebSocket not connected'));
    }

    const messageId = generateUUID();
    const payload = serializeCommand(command, messageId);

    return new Promise<CommandResponse>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const p = this.pending.get(messageId);
        if (p) {
          this.pending.delete(messageId);
          p.reject(new Error('Command timeout'));
        }
      }, 30_000);

      this.pending.set(messageId, { resolve, reject, timeoutId });

      try {
        this.ws!.send(payload);
      } catch (e) {
        clearTimeout(timeoutId);
        this.pending.delete(messageId);
        reject(e);
      }
    });
  }

  private handleMessage(data: ArrayBuffer): void {
    let response: CommandResponse;

    try {
      response = deserializeResponse(data);
    } catch (e) {
      // parsing error => reject all to avoid UI stuck
      this.rejectAllPending(e instanceof Error ? e : new Error('Protocol parse error'));
      return;
    }

    const pending = this.pending.get(response.messageId);
    if (!pending) return;

    this.pending.delete(response.messageId);
    clearTimeout(pending.timeoutId);

    this.zone.run(() => pending.resolve(response));
  }

  private rejectAllPending(err: unknown): void {
    for (const [, p] of this.pending) {
      clearTimeout(p.timeoutId);
      try {
        p.reject(err);
      } catch {}
    }
    this.pending.clear();
  }
}

// (optionnel) re-export utile pour tes imports existants
export type { CommandResponse };
