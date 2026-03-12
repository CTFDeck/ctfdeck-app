import { Injectable, NgZone, inject } from '@angular/core';
import { firstValueFrom, filter, timeout, TimeoutError } from 'rxjs';
import { WebSocketService } from '../../../infrastructure/transport/websocket/websocket.service';
import { MessageType } from '../../../infrastructure/transport/websocket/websocket-message-type.enum';
import { generateUUID } from '../../../infrastructure/transport/websocket/websocket-uuid.utils';
import { WriteUpData, WriteUpMetadata } from '../models/writeup.model';
import {
  deserializeWriteUpCreateResult,
  deserializeWriteUpDeleteResult,
  deserializeWriteUpListResult,
  deserializeWriteUpLoadResult,
  deserializeWriteUpMoveResult,
  deserializeWriteUpOperationError,
  deserializeWriteUpUpdateResult,
  isWriteUpResponse,
  serializeWriteUpCreate,
  serializeWriteUpDelete,
  serializeWriteUpList,
  serializeWriteUpLoad,
  serializeWriteUpMove,
  serializeWriteUpUpdate,
} from './writeup.websocket.protocol';

interface PendingWriteUpResult {
  messageId: string;
  success?: boolean;
  writeUpId?: string;
  writeUps?: WriteUpMetadata[];
  totalCount?: number;
  writeUp?: WriteUpData | null;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class WriteUpClientService {
  private ws = inject(WebSocketService);
  private zone = inject(NgZone);

  private pending = new Map<string, (result: PendingWriteUpResult) => void>();

  constructor() {
    this.ws.registerHandler(this.handleMessage.bind(this));
  }

  private async sendWhenReady(buffer: Uint8Array): Promise<void> {
    if (!this.ws.isConnected$.value) {
      await firstValueFrom(
        this.ws.isConnected$.pipe(
          filter((connected) => connected),
          timeout(10_000),
        ),
      ).catch((err) => {
        if (err instanceof TimeoutError) {
          throw new Error('WebSocket connection timeout after 10s');
        }
        throw err;
      });
    }

    this.ws.sendBinary(buffer);
  }

  private handleMessage(data: Uint8Array): boolean {
    const type = data[0];
    if (!isWriteUpResponse(type)) {
      return false;
    }

    let result: PendingWriteUpResult;

    try {
      switch (type) {
        case MessageType.WriteUpCreateResult:
          result = deserializeWriteUpCreateResult(data);
          break;
        case MessageType.WriteUpUpdateResult:
          result = deserializeWriteUpUpdateResult(data);
          break;
        case MessageType.WriteUpDeleteResult:
          result = deserializeWriteUpDeleteResult(data);
          break;
        case MessageType.WriteUpListResult:
          result = deserializeWriteUpListResult(data);
          break;
        case MessageType.WriteUpLoadResult:
          result = deserializeWriteUpLoadResult(data);
          break;
        case MessageType.WriteUpMoveResult:
          result = deserializeWriteUpMoveResult(data);
          break;
        case MessageType.WriteUpOperationError:
          result = deserializeWriteUpOperationError(data);
          break;
        default:
          return false;
      }
    } catch (error) {
      console.error(`[WriteUpClientService] Failed to deserialize message type ${type}:`, error);
      return true;
    }

    const callback = this.pending.get(result.messageId);
    if (!callback) {
      return true;
    }

    this.zone.run(() => {
      this.pending.delete(result.messageId);
      callback(result);
    });

    return true;
  }

  create(sessionId: string, name: string): Promise<{ success: boolean; writeUpId: string }> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeWriteUpCreate(sessionId, name, messageId);

      this.pending.set(messageId, (result) => {
        if (result.error) {
          reject(new Error(result.error));
          return;
        }

        resolve({
          success: Boolean(result.success),
          writeUpId: result.writeUpId ?? '',
        });
      });

      this.sendWhenReady(buffer).catch((error) => {
        this.pending.delete(messageId);
        reject(error);
      });
    });
  }

  update(writeUpId: string, name: string, content: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeWriteUpUpdate(writeUpId, name, content, messageId);

      this.pending.set(messageId, (result) => {
        if (result.error) {
          reject(new Error(result.error));
          return;
        }

        resolve(Boolean(result.success));
      });

      this.sendWhenReady(buffer).catch((error) => {
        this.pending.delete(messageId);
        reject(error);
      });
    });
  }

  delete(writeUpId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeWriteUpDelete(writeUpId, messageId);

      this.pending.set(messageId, (result) => {
        if (result.error) {
          reject(new Error(result.error));
          return;
        }

        resolve(Boolean(result.success));
      });

      this.sendWhenReady(buffer).catch((error) => {
        this.pending.delete(messageId);
        reject(error);
      });
    });
  }

  list(
    sessionId: string,
    offset = 0,
    limit = 50,
    unassignedOnly = false,
  ): Promise<{ writeUps: WriteUpMetadata[]; totalCount: number }> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeWriteUpList(sessionId, offset, limit, messageId, unassignedOnly);

      this.pending.set(messageId, (result) => {
        if (result.error) {
          reject(new Error(result.error));
          return;
        }

        resolve({
          writeUps: result.writeUps ?? [],
          totalCount: result.totalCount ?? 0,
        });
      });

      this.sendWhenReady(buffer).catch((error) => {
        this.pending.delete(messageId);
        reject(error);
      });
    });
  }

  load(writeUpId: string): Promise<{ success: boolean; writeUp: WriteUpData | null }> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeWriteUpLoad(writeUpId, messageId);

      this.pending.set(messageId, (result) => {
        if (result.error) {
          reject(new Error(result.error));
          return;
        }

        resolve({
          success: Boolean(result.success),
          writeUp: result.writeUp ?? null,
        });
      });

      this.sendWhenReady(buffer).catch((error) => {
        this.pending.delete(messageId);
        reject(error);
      });
    });
  }

  move(writeUpId: string, projectId: string | null, folderId: string | null): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeWriteUpMove(writeUpId, projectId, folderId, messageId);

      this.pending.set(messageId, (result) => {
        if (result.error) {
          reject(new Error(result.error));
          return;
        }

        resolve(Boolean(result.success));
      });

      this.sendWhenReady(buffer).catch((error) => {
        this.pending.delete(messageId);
        reject(error);
      });
    });
  }
}
