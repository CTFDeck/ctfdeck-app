import { Injectable, NgZone } from '@angular/core';
import { WebSocketService } from './websocket.service';
import { generateUUID, MessageType } from './websocket.protocol';
import { firstValueFrom, filter, timeout, TimeoutError } from 'rxjs';
import {
  WriteUpMetadata,
  WriteUpData,
  isWriteUpResponse,
  serializeWriteUpCreate,
  serializeWriteUpUpdate,
  serializeWriteUpDelete,
  serializeWriteUpList,
  serializeWriteUpLoad,
  serializeWriteUpMove,
  deserializeWriteUpCreateResult,
  deserializeWriteUpUpdateResult,
  deserializeWriteUpDeleteResult,
  deserializeWriteUpListResult,
  deserializeWriteUpLoadResult,
  deserializeWriteUpMoveResult,
  deserializeWriteUpOperationError,
} from './writeup.protocol';

@Injectable({ providedIn: 'root' })
export class WriteUpService {
  private pending = new Map<string, (result: any) => void>();

  constructor(
    private ws: WebSocketService,
    private zone: NgZone,
  ) {
    this.ws.registerHandler(this.handleMessage.bind(this));
  }

  /** Waits for WS connection (up to 10s) then sends binary data. */
  private async sendWhenReady(buffer: Uint8Array): Promise<void> {
    if (!this.ws.isConnected$.value) {
      await firstValueFrom(
        this.ws.isConnected$.pipe(
          filter((connected) => connected),
          timeout(10_000),
        ),
      ).catch((err) => {
        if (err instanceof TimeoutError)
          throw new Error('WebSocket connection timeout after 10s');
        throw err;
      });
    }
    this.ws.sendBinary(buffer);
  }

  private handleMessage(data: Uint8Array): boolean {
    const type = data[0];
    if (!isWriteUpResponse(type)) return false;

    let result: any;
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
    } catch (e) {
      console.error(`[WriteUpService] Failed to deserialize message type ${type}:`, e);
      return true; // Still "handled" by this service, but it failed
    }

    const callback = this.pending.get(result.messageId);
    if (callback) {
      this.zone.run(() => {
        this.pending.delete(result.messageId);
        callback(result);
      });
    }

    return true;
  }

  create(sessionId: string, name: string): Promise<{ success: boolean; writeUpId: string }> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeWriteUpCreate(sessionId, name, messageId);
      this.pending.set(messageId, (result) => {
        if (result.error) reject(new Error(result.error));
        else resolve({ success: result.success, writeUpId: result.writeUpId });
      });
      this.sendWhenReady(buffer).catch((err) => {
        this.pending.delete(messageId);
        reject(err);
      });
    });
  }

  update(writeUpId: string, name: string, content: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeWriteUpUpdate(writeUpId, name, content, messageId);
      this.pending.set(messageId, (result) => {
        if (result.error) reject(new Error(result.error));
        else resolve(result.success);
      });
      this.sendWhenReady(buffer).catch((err) => {
        this.pending.delete(messageId);
        reject(err);
      });
    });
  }

  delete(writeUpId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeWriteUpDelete(writeUpId, messageId);
      this.pending.set(messageId, (result) => {
        if (result.error) reject(new Error(result.error));
        else resolve(result.success);
      });
      this.sendWhenReady(buffer).catch((err) => {
        this.pending.delete(messageId);
        reject(err);
      });
    });
  }

  list(sessionId: string, offset: number = 0, limit: number = 50, unassignedOnly: boolean = false): Promise<{ writeUps: WriteUpMetadata[], totalCount: number }> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeWriteUpList(sessionId, offset, limit, messageId, unassignedOnly);
      this.pending.set(messageId, (result) => {
        if (result.error) reject(new Error(result.error));
        else resolve({ writeUps: result.writeUps, totalCount: result.totalCount });
      });
      this.sendWhenReady(buffer).catch((err) => {
        this.pending.delete(messageId);
        reject(err);
      });
    });
  }

  load(writeUpId: string): Promise<{ success: boolean; writeUp: WriteUpData | null }> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeWriteUpLoad(writeUpId, messageId);
      this.pending.set(messageId, (result) => {
        if (result.error) reject(new Error(result.error));
        else resolve({ success: result.success, writeUp: result.writeUp });
      });
      this.sendWhenReady(buffer).catch((err) => {
        this.pending.delete(messageId);
        reject(err);
      });
    });
  }

  move(writeUpId: string, projectId: string | null, folderId: string | null): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeWriteUpMove(writeUpId, projectId, folderId, messageId);
      this.pending.set(messageId, (result) => {
        if (result.error) reject(new Error(result.error));
        else resolve(result.success);
      });
      this.sendWhenReady(buffer).catch((err) => {
        this.pending.delete(messageId);
        reject(err);
      });
    });
  }
}
