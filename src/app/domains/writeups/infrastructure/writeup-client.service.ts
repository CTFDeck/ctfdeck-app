// writeup-client.service.ts
import { Injectable, NgZone, inject } from '@angular/core';
import { WebSocketService } from '../../../infrastructure/transport/websocket/websocket.service';
import { MessageType } from '../../../infrastructure/transport/websocket/websocket-message-type.enum';
import { generateUUID } from '../../../infrastructure/transport/websocket/websocket-uuid.utils';
import {
  PendingMap,
  createWebSocketRequest,
  resolvePendingWebSocketResult,
} from '../../../infrastructure/transport/websocket/websocket-clients.utils';
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
  private pending: PendingMap<PendingWriteUpResult> = new Map();

  constructor() {
    this.ws.registerHandler(this.handleMessage.bind(this));
  }

  private handleMessage(data: Uint8Array): boolean {
    const type = data[0];
    if (!isWriteUpResponse(type)) return false;

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

    resolvePendingWebSocketResult(this.pending, result, this.zone);
    return true;
  }

  create(sessionId: string, name: string): Promise<{ success: boolean; writeUpId: string }> {
    const messageId = generateUUID();
    return createWebSocketRequest(this.pending, this.ws, messageId, serializeWriteUpCreate(sessionId, name, messageId), (r) => ({ success: Boolean(r.success), writeUpId: r.writeUpId ?? '' }), Promise.reject.bind(Promise));
  }

  update(writeUpId: string, name: string, content: string): Promise<boolean> {
    const messageId = generateUUID();
    return createWebSocketRequest(this.pending, this.ws, messageId, serializeWriteUpUpdate(writeUpId, name, content, messageId), (r) => Boolean(r.success), Promise.reject.bind(Promise));
  }

  delete(writeUpId: string): Promise<boolean> {
    const messageId = generateUUID();
    return createWebSocketRequest(this.pending, this.ws, messageId, serializeWriteUpDelete(writeUpId, messageId), (r) => Boolean(r.success), Promise.reject.bind(Promise));
  }

  list(sessionId: string, offset = 0, limit = 50, unassignedOnly = false): Promise<{ writeUps: WriteUpMetadata[]; totalCount: number }> {
    const messageId = generateUUID();
    return createWebSocketRequest(this.pending, this.ws, messageId, serializeWriteUpList(sessionId, offset, limit, messageId, unassignedOnly), (r) => ({ writeUps: r.writeUps ?? [], totalCount: r.totalCount ?? 0 }), Promise.reject.bind(Promise));
  }

  load(writeUpId: string): Promise<{ success: boolean; writeUp: WriteUpData | null }> {
    const messageId = generateUUID();
    return createWebSocketRequest(this.pending, this.ws, messageId, serializeWriteUpLoad(writeUpId, messageId), (r) => ({ success: Boolean(r.success), writeUp: r.writeUp ?? null }), Promise.reject.bind(Promise));
  }

  move(writeUpId: string, projectId: string | null, folderId: string | null): Promise<boolean> {
    const messageId = generateUUID();
    return createWebSocketRequest(this.pending, this.ws, messageId, serializeWriteUpMove(writeUpId, projectId, folderId, messageId), (r) => Boolean(r.success), Promise.reject.bind(Promise));
  }
}
