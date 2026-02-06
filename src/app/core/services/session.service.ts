import { Injectable } from '@angular/core';
import { WebSocketService } from './websocket.service';
import { generateUUID } from './websocket.protocol';
import {
  MessageType,
  SessionTarget,
  SessionMetadata,
  SessionData,
  serializeSessionCreate,
  serializeSessionSetActive,
  serializeSessionLoad,
  serializeSessionList,
  serializeSessionDelete,
  serializeSessionUpdateTargets,
  serializeSessionUpdate,
  serializeSessionAddTarget,
  serializeSessionDeleteTarget,
  serializeSessionEditTarget,
  isSessionResponse,
  deserializeSessionCreateResult,
  deserializeSessionSetActiveResult,
  deserializeSessionLoadResult,
  deserializeSessionListResult,
  deserializeSessionDeleteResult,
  deserializeSessionUpdateResult,
  deserializeSessionAddTargetResult,
  deserializeSessionDeleteTargetResult,
  deserializeSessionEditTargetResult,
  deserializeSessionOperationError,
} from './session.protocol';

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private pending = new Map<string, (result: any) => void>();
  private activeSessionId: string | null = null;

  constructor(private ws: WebSocketService) {
    this.ws.registerHandler(this.handleMessage.bind(this));
  }

  handleMessage(data: Uint8Array): boolean {
    const type = data[0];
    if (!isSessionResponse(type)) return false;

    let result: any;
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

    const callback = this.pending.get(result.messageId);
    if (callback) {
      this.pending.delete(result.messageId);
      callback(result);
    }

    return true;
  }

  create(name: string): Promise<{ success: boolean; sessionId: string }> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeSessionCreate(name, messageId);

      this.pending.set(messageId, (result) => {
        if (result.error) {
          reject(new Error(result.error));
        } else {
          resolve({ success: result.success, sessionId: result.sessionId });
        }
      });

      this.ws.sendBinary(buffer);
    });
  }

  setActive(sessionId: string | null): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeSessionSetActive(sessionId || EMPTY_GUID, messageId);

      this.pending.set(messageId, (result) => {
        if (result.error) {
          reject(new Error(result.error));
        } else {
          this.activeSessionId = result.success ? sessionId : null;
          resolve(result.success);
        }
      });

      this.ws.sendBinary(buffer);
    });
  }

  load(sessionId: string): Promise<{ success: boolean; session: SessionData | null }> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeSessionLoad(sessionId, messageId);

      this.pending.set(messageId, (result) => {
        if (result.error) {
          reject(new Error(result.error));
        } else {
          resolve({ success: result.success, session: result.session });
        }
      });

      this.ws.sendBinary(buffer);
    });
  }

  list(): Promise<SessionMetadata[]> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeSessionList(messageId);

      this.pending.set(messageId, (result) => {
        if (result.error) {
          reject(new Error(result.error));
        } else {
          resolve(result.sessions);
        }
      });

      this.ws.sendBinary(buffer);
    });
  }

  delete(sessionId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeSessionDelete(sessionId, messageId);

      this.pending.set(messageId, (result) => {
        if (result.error) {
          reject(new Error(result.error));
        } else {
          if (result.success && this.activeSessionId === sessionId) {
            this.activeSessionId = null;
          }
          resolve(result.success);
        }
      });

      this.ws.sendBinary(buffer);
    });
  }

  updateTargets(sessionId: string, targets: SessionTarget[]): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeSessionUpdateTargets(sessionId, targets, messageId);

      this.pending.set(messageId, (result) => {
        if (result.error) {
          reject(new Error(result.error));
        } else {
          resolve(result.success);
        }
      });

      this.ws.sendBinary(buffer);
    });
  }

  update(sessionId: string, name: string, description: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeSessionUpdate(sessionId, name, description, messageId);

      this.pending.set(messageId, (result) => {
        if (result.error) {
          reject(new Error(result.error));
        } else {
          resolve(result.success);
        }
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
        if (result.error) {
          reject(new Error(result.error));
        } else {
          resolve({ success: result.success, targetId: result.targetId });
        }
      });

      this.ws.sendBinary(buffer);
    });
  }

  deleteTarget(sessionId: string, targetId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeSessionDeleteTarget(sessionId, targetId, messageId);

      this.pending.set(messageId, (result) => {
        if (result.error) {
          reject(new Error(result.error));
        } else {
          resolve(result.success);
        }
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
        if (result.error) {
          reject(new Error(result.error));
        } else {
          resolve(result.success);
        }
      });

      this.ws.sendBinary(buffer);
    });
  }

  getActiveSessionId(): string | null {
    return this.activeSessionId;
  }
}
