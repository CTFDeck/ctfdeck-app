import { Injectable, NgZone, inject } from '@angular/core';
import { WebSocketService } from '../../../infrastructure/transport/websocket/websocket.service';
import { generateUUID } from '../../../infrastructure/transport/websocket/websocket-uuid.utils';
import { MessageType } from '../../../infrastructure/transport/websocket/websocket-message-type.enum';
import type { SessionData } from '../models/session-data.model';
import type { SessionListResponse } from '../models/session-list-response.model';
import { EMPTY_GUID } from './session.constants';
import {
  deserializeSessionAddTargetResult,
  deserializeSessionCreateResult,
  deserializeSessionDeleteResult,
  deserializeSessionDeleteTargetResult,
  deserializeSessionEditTargetResult,
  deserializeSessionListResult,
  deserializeSessionLoadResult,
  deserializeSessionOperationError,
  deserializeSessionSetActiveResult,
  deserializeSessionUpdateResult,
  isSessionResponse,
  serializeSessionAddTarget,
  serializeSessionCreate,
  serializeSessionDelete,
  serializeSessionDeleteTarget,
  serializeSessionEditTarget,
  serializeSessionList,
  serializeSessionLoad,
  serializeSessionSetActive,
  serializeSessionUpdate,
} from './session.websocket.protocol';

interface SessionCreateResult {
  messageId: string;
  success: boolean;
  sessionId: string;
}

interface SessionBooleanResult {
  messageId: string;
  success: boolean;
}

interface SessionLoadResult {
  messageId: string;
  success: boolean;
  session: SessionData | null;
}

interface SessionListResult {
  messageId: string;
  totalCount: number;
  sessions: SessionListResponse['sessions'];
}

interface SessionAddTargetResult {
  messageId: string;
  success: boolean;
  targetId: string;
}

interface SessionErrorResult {
  messageId: string;
  error: string;
}

type SessionPendingResult =
  | SessionCreateResult
  | SessionBooleanResult
  | SessionLoadResult
  | SessionListResult
  | SessionAddTargetResult
  | SessionErrorResult;

@Injectable({ providedIn: 'root' })
export class SessionClientService {
  private readonly ws = inject(WebSocketService);
  private readonly zone = inject(NgZone);

  private readonly pending = new Map<string, (result: SessionPendingResult) => void>();
  private activeSessionId: string | null = null;
  private activeProjectId: string | null = null;

  constructor() {
    this.ws.registerHandler(this.handleMessage.bind(this));
  }

  create(name: string): Promise<{ success: boolean; sessionId: string }> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeSessionCreate(name, messageId);

      this.pending.set(messageId, (result) => {
        if (this.isErrorResult(result)) {
          reject(new Error(result.error));
          return;
        }

        if (!this.isCreateResult(result)) {
          reject(new Error('Unexpected session create response'));
          return;
        }

        resolve({
          success: result.success,
          sessionId: result.sessionId,
        });
      });

      this.ws.sendBinary(buffer);
    });
  }

  setActive(sessionId: string | null): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeSessionSetActive(sessionId || EMPTY_GUID, messageId);

      this.pending.set(messageId, (result) => {
        if (this.isErrorResult(result)) {
          reject(new Error(result.error));
          return;
        }

        if (!this.isBooleanResult(result)) {
          reject(new Error('Unexpected session set active response'));
          return;
        }

        this.activeSessionId = result.success ? sessionId : null;
        resolve(result.success);
      });

      this.ws.sendBinary(buffer);
    });
  }

  load(sessionId: string): Promise<{ success: boolean; session: SessionData | null }> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeSessionLoad(sessionId, messageId);

      this.pending.set(messageId, (result) => {
        if (this.isErrorResult(result)) {
          reject(new Error(result.error));
          return;
        }

        if (!this.isLoadResult(result)) {
          reject(new Error('Unexpected session load response'));
          return;
        }

        if (result.success && result.session) {
          this.activeProjectId = result.session.projectId;
        }

        resolve({
          success: result.success,
          session: result.session,
        });
      });

      this.ws.sendBinary(buffer);
    });
  }

  list(offset = 0, limit = 50, unassignedOnly = false): Promise<SessionListResponse> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeSessionList(offset, limit, messageId, unassignedOnly);

      this.pending.set(messageId, (result) => {
        if (this.isErrorResult(result)) {
          reject(new Error(result.error));
          return;
        }

        if (!this.isListResult(result)) {
          reject(new Error('Unexpected session list response'));
          return;
        }

        resolve({
          sessions: result.sessions,
          totalCount: result.totalCount,
        });
      });

      this.ws.sendBinary(buffer);
    });
  }

  delete(sessionId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeSessionDelete(sessionId, messageId);

      this.pending.set(messageId, (result) => {
        if (this.isErrorResult(result)) {
          reject(new Error(result.error));
          return;
        }

        if (!this.isBooleanResult(result)) {
          reject(new Error('Unexpected session delete response'));
          return;
        }

        if (result.success && this.activeSessionId === sessionId) {
          this.activeSessionId = null;
        }

        resolve(result.success);
      });

      this.ws.sendBinary(buffer);
    });
  }

  update(sessionId: string, name: string, description: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeSessionUpdate(sessionId, name, description, messageId);

      this.pending.set(messageId, (result) => {
        if (this.isErrorResult(result)) {
          reject(new Error(result.error));
          return;
        }

        if (!this.isBooleanResult(result)) {
          reject(new Error('Unexpected session update response'));
          return;
        }

        resolve(result.success);
      });

      this.ws.sendBinary(buffer);
    });
  }

  addTarget(
    sessionId: string,
    address: string,
    port: number | null,
    name: string,
    type: number,
    description = '',
  ): Promise<{ success: boolean; targetId: string }> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeSessionAddTarget(
        sessionId,
        address,
        port,
        name,
        type,
        description,
        messageId,
      );

      this.pending.set(messageId, (result) => {
        if (this.isErrorResult(result)) {
          reject(new Error(result.error));
          return;
        }

        if (!this.isAddTargetResult(result)) {
          reject(new Error('Unexpected session add target response'));
          return;
        }

        resolve({
          success: result.success,
          targetId: result.targetId,
        });
      });

      this.ws.sendBinary(buffer);
    });
  }

  deleteTarget(sessionId: string, targetId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeSessionDeleteTarget(sessionId, targetId, messageId);

      this.pending.set(messageId, (result) => {
        if (this.isErrorResult(result)) {
          reject(new Error(result.error));
          return;
        }

        if (!this.isBooleanResult(result)) {
          reject(new Error('Unexpected session delete target response'));
          return;
        }

        resolve(result.success);
      });

      this.ws.sendBinary(buffer);
    });
  }

  editTarget(
    sessionId: string,
    targetId: string,
    address: string,
    port: number | null,
    name: string,
    type: number,
    description = '',
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeSessionEditTarget(
        sessionId,
        targetId,
        address,
        port,
        name,
        type,
        description,
        messageId,
      );

      this.pending.set(messageId, (result) => {
        if (this.isErrorResult(result)) {
          reject(new Error(result.error));
          return;
        }

        if (!this.isBooleanResult(result)) {
          reject(new Error('Unexpected session edit target response'));
          return;
        }

        resolve(result.success);
      });

      this.ws.sendBinary(buffer);
    });
  }

  private handleMessage(data: Uint8Array): boolean {
    const type = data[0];

    if (!isSessionResponse(type)) {
      return false;
    }

    let result: SessionPendingResult;

    try {
      switch (type) {
        case MessageType.SessionCreateResult:
          result = deserializeSessionCreateResult(data);
          break;
        case MessageType.SessionSetActiveResult:
          result = deserializeSessionSetActiveResult(data);
          break;
        case MessageType.SessionLoadResult:
          result = deserializeSessionLoadResult(data);
          break;
        case MessageType.SessionListResult:
          result = deserializeSessionListResult(data);
          break;
        case MessageType.SessionDeleteResult:
          result = deserializeSessionDeleteResult(data);
          break;
        case MessageType.SessionUpdateResult:
          result = deserializeSessionUpdateResult(data);
          break;
        case MessageType.SessionAddTargetResult:
          result = deserializeSessionAddTargetResult(data);
          break;
        case MessageType.SessionDeleteTargetResult:
          result = deserializeSessionDeleteTargetResult(data);
          break;
        case MessageType.SessionEditTargetResult:
          result = deserializeSessionEditTargetResult(data);
          break;
        case MessageType.SessionOperationError:
          result = deserializeSessionOperationError(data);
          break;
        default:
          return false;
      }
    } catch (error) {
      console.error(`[SessionClientService] Failed to deserialize message type ${type}:`, error);
      return true;
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

  private isErrorResult(result: SessionPendingResult): result is SessionErrorResult {
    return 'error' in result;
  }

  private isCreateResult(result: SessionPendingResult): result is SessionCreateResult {
    return 'success' in result && 'sessionId' in result;
  }

  private isBooleanResult(result: SessionPendingResult): result is SessionBooleanResult {
    return (
      'success' in result &&
      !('sessionId' in result) &&
      !('session' in result) &&
      !('targetId' in result)
    );
  }

  private isLoadResult(result: SessionPendingResult): result is SessionLoadResult {
    return 'success' in result && 'session' in result;
  }

  private isListResult(result: SessionPendingResult): result is SessionListResult {
    return 'totalCount' in result && 'sessions' in result;
  }

  private isAddTargetResult(result: SessionPendingResult): result is SessionAddTargetResult {
    return 'success' in result && 'targetId' in result;
  }
}
