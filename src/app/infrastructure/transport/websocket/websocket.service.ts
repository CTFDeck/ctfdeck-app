import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SudoPasswordModalStore } from '../../../shell/sudo-password-modal/sudo-password-modal.store';
import {
  CommandResponse,
  deserializeMessage,
  PasswordRequest,
  serializeCommand,
  serializePasswordProvide,
  StreamChunk,
  StreamEnd,
  StreamMessage,
} from './websocket-command.protocol';
import { MessageType } from './websocket-message-type.enum';
import { generateUUID } from './websocket-uuid.utils';

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
  private currentUrl = 'ws://localhost:42712';
  private retryCount = 0;
  private readonly maxRetries = 10;
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;
  private manualDisconnect = false;

  private readonly isConnectedSubject = new BehaviorSubject<boolean>(false);
  public readonly isConnected$ = this.isConnectedSubject;

  private readonly pending = new Map<
    string,
    {
      resolve: (response: CommandResponse) => void;
      reject: (error: unknown) => void;
      timeoutId: ReturnType<typeof setTimeout>;
    }
  >();

  private readonly streamingCallbacks = new Map<string, StreamingCallbacks>();
  private readonly messageHandlers = new Set<(data: Uint8Array) => boolean>();

  constructor(
    private readonly zone: NgZone,
    private readonly sudoModal: SudoPasswordModalStore,
  ) {
    this.connectWithRetry();
  }

  setUrl(url: string): void {
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

    return new Promise<void>((resolve, reject) => {
      try {
        this.cleanupSocket();

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

        ws.onerror = (error) => {
          this.zone.run(() => {
            if (!this.isConnectedSubject.value) {
              reject(error);
            }
          });
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
      } catch (error) {
        reject(error);
        this.scheduleRetry();
      }
    });
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

          if (response.output) {
            onOutput(response.output);
          }

          if (response.error) {
            onError(response.error);
          }

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
      } catch (error) {
        clearTimeout(timeoutId);
        this.streamingCallbacks.delete(messageId);
        this.pending.delete(messageId);
        reject(error);
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

  private connectWithRetry(): void {
    this.manualDisconnect = false;
    this.connectInternal();
  }

  private connectInternal(): void {
    if (this.manualDisconnect) {
      return;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      this.cleanupSocket();

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

      ws.onerror = () => {};

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

  private cleanupSocket(): void {
    if (!this.ws) {
      return;
    }

    try {
      this.ws.onopen = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.close();
    } catch {}

    this.ws = null;
  }

  private scheduleRetry(): void {
    if (this.manualDisconnect || this.retryCount >= this.maxRetries || this.retryTimeout) {
      return;
    }

    const delay =
      this.retryCount === 0 ? 0 : Math.min(500 * Math.pow(2, this.retryCount - 1), 10_000);

    this.retryCount++;

    this.retryTimeout = setTimeout(() => {
      this.retryTimeout = null;
      this.connectInternal();
    }, delay);
  }

  private handleMessage(data: ArrayBuffer): void {
    const u8 = new Uint8Array(data);
    const type = u8[0] as MessageType;

    if (type === MessageType.PasswordRequest) {
      this.handlePasswordRequest(u8);
      return;
    }

    if (
      type === MessageType.CompleteResponse ||
      type === MessageType.StreamOutput ||
      type === MessageType.StreamError ||
      type === MessageType.StreamEnd
    ) {
      this.handleCommandMessage(u8);
      return;
    }

    let handled = false;

    for (const handler of this.messageHandlers) {
      try {
        if (handler(u8)) {
          handled = true;
          break;
        }
      } catch (error) {
        console.error('Message handler error:', error);
      }
    }

    if (!handled) {
      console.warn('Unhandled message type:', type);
    }
  }

  private handlePasswordRequest(data: Uint8Array): void {
    let message: PasswordRequest;

    try {
      message = deserializeMessage(data) as PasswordRequest;
    } catch (error) {
      console.error('Failed to parse PasswordRequest:', error);
      return;
    }

    this.zone.run(async () => {
      const password = await this.sudoModal.requestPassword(message.messageId, message.prompt);

      const payload = serializePasswordProvide(message.messageId, password ?? '');
      this.sendBinary(payload);
    });
  }

  private handleCommandMessage(data: Uint8Array): void {
    let message: StreamMessage;

    try {
      message = deserializeMessage(data);
    } catch (error) {
      console.error('Failed to parse message:', error);
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
  }

  private handleCompleteResponse(response: CommandResponse): void {
    const pendingRequest = this.pending.get(response.messageId);

    if (!pendingRequest) {
      return;
    }

    this.pending.delete(response.messageId);
    clearTimeout(pendingRequest.timeoutId);
    pendingRequest.resolve(response);
  }

  private handleStreamChunk(chunk: StreamChunk): void {
    const callbacks = this.streamingCallbacks.get(chunk.messageId);

    if (!callbacks) {
      return;
    }

    if (chunk.isError) {
      callbacks.onError(chunk.data);
      return;
    }

    callbacks.onOutput(chunk.data);
  }

  private handleStreamEnd(end: StreamEnd): void {
    const callbacks = this.streamingCallbacks.get(end.messageId);

    if (callbacks) {
      callbacks.onComplete({
        exitCode: end.exitCode,
        workingDirectory: end.workingDirectory,
      });
    }

    const pendingRequest = this.pending.get(end.messageId);

    if (pendingRequest) {
      clearTimeout(pendingRequest.timeoutId);
      this.pending.delete(end.messageId);
    }
  }

  private rejectAllPending(error: unknown): void {
    for (const [, pendingRequest] of this.pending) {
      clearTimeout(pendingRequest.timeoutId);

      try {
        pendingRequest.reject(error);
      } catch {}
    }

    this.pending.clear();
    this.streamingCallbacks.clear();
  }
}

export type { CommandResponse, StreamChunk, StreamEnd };
