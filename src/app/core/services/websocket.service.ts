import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  serializeCommand,
  deserializeMessage,
  generateUUID,
  CommandResponse,
  StreamChunk,
  StreamEnd,
  StreamMessage,
  MessageType,
  serializePasswordProvide,
  PasswordRequest,
} from './websocket.protocol';
import { SudoPasswordModalService } from './sudo-password-modal.service';

export interface StreamingResult {
  exitCode: number;
  workingDirectory: string;
}

export interface StreamingCallbacks {
  onOutput: (data: string) => void;
  onError: (data: string) => void;
  onComplete: (result: StreamingResult) => void;
}

@Injectable({ providedIn: 'root' })
export class WebSocketService {
  private ws: WebSocket | null = null;

  private isConnectedSubject = new BehaviorSubject<boolean>(false);
  public isConnected$ = this.isConnectedSubject; // BehaviorSubject — .value is readable synchronously

  private pending = new Map<
    string,
    {
      resolve: (r: CommandResponse) => void;
      reject: (e: unknown) => void;
      timeoutId: ReturnType<typeof setTimeout>;
    }
  >();

  private streamingCallbacks = new Map<string, StreamingCallbacks>();
  private messageHandlers = new Set<(data: Uint8Array) => boolean>();
  private currentUrl = 'ws://localhost:42712';

  private retryCount = 0;
  private readonly MAX_RETRIES = 10;
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;
  private manualDisconnect = false;

  constructor(
    private zone: NgZone,
    private sudoModal: SudoPasswordModalService,
  ) {
    // Connect immediately — works on Chrome. Firefox may cancel the connection
    // during page load; onclose will fire and scheduleRetry handles the reconnect.
    this.connectWithRetry();
  }

  setUrl(url: string) {
    this.currentUrl = url;
  }

  getUrl(): string {
    return this.currentUrl;
  }

  connect(url?: string): Promise<void> {
    const target = url ?? this.currentUrl;
    this.currentUrl = target;
    this.manualDisconnect = false;
    this.retryCount = 0;
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }

    return new Promise((resolve, reject) => {
      try {
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
            this.retryCount = 0;
            this.isConnectedSubject.next(true);
            resolve();
          });
        };

        ws.onmessage = (event) => {
          this.handleMessage(event.data as ArrayBuffer);
        };

        ws.onerror = (err) => {
          this.zone.run(() => {
            if (!this.isConnectedSubject.value) reject(err);
          });
        };

        ws.onclose = () => {
          this.zone.run(() => {
            this.isConnectedSubject.next(false);
            this.rejectAllPending(new Error('Connection closed'));
            // Auto-reconnect if not a manual disconnect
            if (!this.manualDisconnect) {
              this.scheduleRetry();
            }
          });
        };
      } catch (e) {
        reject(e);
        this.scheduleRetry();
      }
    });
  }

  private connectWithRetry(): void {
    this.manualDisconnect = false;
    this.connectInternal();
  }

  private connectInternal(): void {
    if (this.manualDisconnect) return;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

    try {
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

      const ws = new WebSocket(this.currentUrl);
      ws.binaryType = 'arraybuffer';
      this.ws = ws;

      ws.onopen = () => {
        this.zone.run(() => {
          this.retryCount = 0;
          this.isConnectedSubject.next(true);
        });
      };

      ws.onmessage = (event) => {
        this.handleMessage(event.data as ArrayBuffer);
      };

      ws.onerror = () => {
        // handled by onclose
      };

      ws.onclose = () => {
        this.zone.run(() => {
          this.isConnectedSubject.next(false);
          this.rejectAllPending(new Error('Connection closed'));
          if (!this.manualDisconnect) {
            this.scheduleRetry();
          }
        });
      };
    } catch {
      this.scheduleRetry();
    }
  }

  private scheduleRetry(): void {
    if (this.manualDisconnect || this.retryCount >= this.MAX_RETRIES) return;
    if (this.retryTimeout) return; // already scheduled

    // First retry is immediate (catches Firefox page-load cancellation).
    // Subsequent retries use exponential backoff: 500ms, 1s, 2s, 4s… capped at 10s.
    const delay = this.retryCount === 0 ? 0 : Math.min(500 * Math.pow(2, this.retryCount - 1), 10_000);
    this.retryCount++;
    this.retryTimeout = setTimeout(() => {
      this.retryTimeout = null;
      this.connectInternal();
    }, delay);
  }

  disconnect(): void {
    this.manualDisconnect = true;
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
    this.retryCount = 0;
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

  registerHandler(handler: (data: Uint8Array) => boolean): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  sendBinary(data: Uint8Array): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }
    this.ws.send(data);
  }

  executeCommandStreaming(
    command: string,
    onOutput: (data: string) => void,
    onError: (data: string) => void,
  ): Promise<StreamingResult> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('WebSocket not connected'));
    }

    const messageId = generateUUID();
    const payload = serializeCommand(command, messageId);

    return new Promise<StreamingResult>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.streamingCallbacks.delete(messageId);
        this.pending.delete(messageId);
        reject(new Error('Command timeout'));
      }, 300_000);

      this.streamingCallbacks.set(messageId, {
        onOutput,
        onError,
        onComplete: (result) => {
          clearTimeout(timeoutId);
          this.streamingCallbacks.delete(messageId);
          resolve(result);
        },
      });

      this.pending.set(messageId, {
        resolve: (response) => {
          clearTimeout(timeoutId);
          this.streamingCallbacks.delete(messageId);
          if (response.output) onOutput(response.output);
          if (response.error) onError(response.error);
          resolve({
            exitCode: response.exitCode,
            workingDirectory: response.workingDirectory,
          });
        },
        reject,
        timeoutId,
      });

      try {
        this.ws!.send(payload);
      } catch (e) {
        clearTimeout(timeoutId);
        this.streamingCallbacks.delete(messageId);
        this.pending.delete(messageId);
        reject(e);
      }
    });
  }

  executeCommand(command: string): Promise<CommandResponse> {
    return new Promise<CommandResponse>((resolve, reject) => {
      this.executeCommandStreaming(
        command,
        () => {},
        () => {},
      )
        .then((result) => {
          resolve({
            type: MessageType.CompleteResponse,
            exitCode: result.exitCode,
            commandOutput: '',
            output: '',
            error: '',
            workingDirectory: result.workingDirectory,
            messageId: '',
          });
        })
        .catch(reject);
    });
  }

  private handleMessage(data: ArrayBuffer): void {
    const u8 = new Uint8Array(data);
    const type = u8[0] as MessageType;

    // Handle sudo password request first

    if (type === MessageType.PasswordRequest) {
      let msg: PasswordRequest;
      try {
        msg = deserializeMessage(u8) as PasswordRequest;
      } catch (e) {
        console.error('Failed to parse PasswordRequest:', e);
        return;
      }

      this.zone.run(async () => {
        const password = await this.sudoModal.requestPassword(msg.messageId, msg.prompt);
        const payload = serializePasswordProvide(msg.messageId, password ?? '');
        this.sendBinary(payload);
      });

      return;
    }

    if (
      type === MessageType.CompleteResponse ||
      type === MessageType.StreamOutput ||
      type === MessageType.StreamError ||
      type === MessageType.StreamEnd
    ) {
      let message: StreamMessage;

      try {
        message = deserializeMessage(u8);
      } catch (e) {
        console.error('Failed to parse message:', e);
        return;
      }

      this.zone.run(() => {
        switch (message.type) {
          case MessageType.CompleteResponse:
            this.handleCompleteResponse(message as CommandResponse);
            break;
          case MessageType.StreamOutput:
          case MessageType.StreamError:
            this.handleStreamChunk(message as StreamChunk);
            break;
          case MessageType.StreamEnd:
            this.handleStreamEnd(message as StreamEnd);
            break;
        }
      });
      return;
    }

    let handled = false;
    for (const handler of this.messageHandlers) {
      try {
        if (handler(u8)) {
          handled = true;
          break;
        }
      } catch (e) {
        console.error('Message handler error:', e);
      }
    }

    if (!handled) {
      console.warn('Unhandled message type:', type);
    }
  }

  private handleCompleteResponse(response: CommandResponse): void {
    const pending = this.pending.get(response.messageId);
    if (!pending) return;

    this.pending.delete(response.messageId);
    clearTimeout(pending.timeoutId);
    pending.resolve(response);
  }

  private handleStreamChunk(chunk: StreamChunk): void {
    const callbacks = this.streamingCallbacks.get(chunk.messageId);
    if (!callbacks) return;

    if (chunk.isError) callbacks.onError(chunk.data);
    else callbacks.onOutput(chunk.data);
  }

  private handleStreamEnd(end: StreamEnd): void {
    const callbacks = this.streamingCallbacks.get(end.messageId);
    if (callbacks) {
      callbacks.onComplete({
        exitCode: end.exitCode,
        workingDirectory: end.workingDirectory,
      });
    }

    const pending = this.pending.get(end.messageId);
    if (pending) {
      clearTimeout(pending.timeoutId);
      this.pending.delete(end.messageId);
    }
  }

  private rejectAllPending(err: unknown): void {
    for (const [, p] of this.pending) {
      clearTimeout(p.timeoutId);
      try {
        p.reject(err);
      } catch {}
    }
    this.pending.clear();
    this.streamingCallbacks.clear();
  }
}

export type { CommandResponse, StreamChunk, StreamEnd };
