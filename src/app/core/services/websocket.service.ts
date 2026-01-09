import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import {
  serializeCommand,
  deserializeMessage,
  generateUUID,
  CommandResponse,
  StreamChunk,
  StreamEnd,
  StreamMessage,
  MessageType,
} from './websocket.protocol';

/**
 * Streaming command result that accumulates output
 */
export interface StreamingResult {
  exitCode: number;
  workingDirectory: string;
}

/**
 * Callbacks for streaming command execution
 */
export interface StreamingCallbacks {
  onOutput: (data: string) => void;
  onError: (data: string) => void;
  onComplete: (result: StreamingResult) => void;
}

@Injectable({ providedIn: 'root' })
export class WebSocketService {
  private ws: WebSocket | null = null;

  private isConnectedSubject = new BehaviorSubject<boolean>(false);
  public isConnected$ = this.isConnectedSubject.asObservable();

  // Legacy pending for complete responses
  private pending = new Map<
    string,
    {
      resolve: (r: CommandResponse) => void;
      reject: (e: unknown) => void;
      timeoutId: ReturnType<typeof setTimeout>;
    }
  >();

  // Streaming callbacks per messageId
  private streamingCallbacks = new Map<string, StreamingCallbacks>();

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

  /**
   * Execute command with streaming output.
   * Returns a promise that resolves when all output is received.
   */
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
      }, 300_000); // 5 minute timeout for long commands

      // Register streaming callbacks
      this.streamingCallbacks.set(messageId, {
        onOutput,
        onError,
        onComplete: (result) => {
          clearTimeout(timeoutId);
          this.streamingCallbacks.delete(messageId);
          resolve(result);
        },
      });

      // Also register pending for fallback to complete response
      this.pending.set(messageId, {
        resolve: (response) => {
          clearTimeout(timeoutId);
          this.streamingCallbacks.delete(messageId);
          // Convert complete response to streaming result format
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

  /**
   * Legacy non-streaming execute (for backward compatibility)
   */
  executeCommand(command: string): Promise<CommandResponse> {
    return new Promise<CommandResponse>((resolve, reject) => {
      this.executeCommandStreaming(
        command,
        () => {}, // Ignore streaming output
        () => {}, // Ignore streaming errors
      )
        .then((result) => {
          // This shouldn't happen with streaming, but handle it
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
    let message: StreamMessage;

    try {
      message = deserializeMessage(data);
    } catch (e) {
      console.error('Failed to parse message:', e);
      return;
    }

    this.zone.run(() => {
      switch (message.type) {
        case MessageType.CompleteResponse:
          this.handleCompleteResponse(message);
          break;
        case MessageType.StreamOutput:
        case MessageType.StreamError:
          this.handleStreamChunk(message);
          break;
        case MessageType.StreamEnd:
          this.handleStreamEnd(message);
          break;
      }
    });
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

    if (chunk.isError) {
      callbacks.onError(chunk.data);
    } else {
      callbacks.onOutput(chunk.data);
    }
  }

  private handleStreamEnd(end: StreamEnd): void {
    const callbacks = this.streamingCallbacks.get(end.messageId);
    if (callbacks) {
      callbacks.onComplete({
        exitCode: end.exitCode,
        workingDirectory: end.workingDirectory,
      });
    }

    // Also clean up pending (if registered)
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

// Re-export for existing imports
export type { CommandResponse, StreamChunk, StreamEnd };
