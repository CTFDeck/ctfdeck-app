import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { WebSocketService } from '../../infrastructure/transport/websocket/websocket.service';
import { generateUUID } from './websocket.protocol';
import {
  MessageType,
  isCustomScriptResponse,
  serializeCustomScriptCreate,
  serializeCustomScriptUpdate,
  serializeCustomScriptDelete,
  serializeCustomScriptList,
  deserializeCustomScriptCreateResult,
  deserializeCustomScriptUpdateResult,
  deserializeCustomScriptDeleteResult,
  deserializeCustomScriptListResult,
  deserializeCustomScriptOperationError,
} from './session.protocol';

export interface CustomScript {
  id: string;
  name: string;
  category: number;
  template: string;
}

@Injectable({ providedIn: 'root' })
export class ScriptService {
  private static readonly LIST_TIMEOUT_MS = 5000;
  private static readonly RETRY_DELAY_MS = 400;

  private scriptsSubject = new BehaviorSubject<CustomScript[]>([]);
  scripts$ = this.scriptsSubject.asObservable();

  private loadingSubject = new BehaviorSubject<boolean>(false);
  isLoading$ = this.loadingSubject.asObservable();

  private pending = new Map<string, (result: any) => void>();
  private listRequest: Promise<CustomScript[]> | null = null;
  private isConnected = false;

  constructor(
    private ws: WebSocketService,
    private zone: NgZone,
  ) {
    this.ws.registerHandler(this.handleMessage.bind(this));
    this.ws.isConnected$.subscribe((connected) => {
      this.zone.run(() => {
        this.isConnected = connected;
        if (connected) {
          void this.refreshList();
        } else {
          this.scriptsSubject.next([]);
        }
      });
    });
  }

  handleMessage(data: Uint8Array): boolean {
    const type = data[0];
    if (!isCustomScriptResponse(type)) return false;

    let result: any;
    switch (type) {
      case MessageType.CustomScriptCreateResult:
        result = deserializeCustomScriptCreateResult(data);
        break;
      case MessageType.CustomScriptUpdateResult:
        result = deserializeCustomScriptUpdateResult(data);
        break;
      case MessageType.CustomScriptDeleteResult:
        result = deserializeCustomScriptDeleteResult(data);
        break;
      case MessageType.CustomScriptListResult:
        result = deserializeCustomScriptListResult(data);
        break;
      case MessageType.CustomScriptOperationError:
        result = deserializeCustomScriptOperationError(data);
        break;
      default:
        return false;
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

  create(
    name: string,
    category: number,
    template: string,
  ): Promise<{ success: boolean; scriptId: string }> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeCustomScriptCreate(name, category, template, messageId);

      this.pending.set(messageId, async (result) => {
        if (result.error) {
          reject(new Error(result.error));
        } else {
          await this.refreshList(true);
          resolve({ success: result.success, scriptId: result.scriptId });
        }
      });

      try {
        this.ws.sendBinary(buffer);
      } catch (err) {
        this.pending.delete(messageId);
        reject(err);
      }
    });
  }

  update(scriptId: string, name: string, category: number, template: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeCustomScriptUpdate(scriptId, name, category, template, messageId);

      this.pending.set(messageId, async (result) => {
        if (result.error) {
          reject(new Error(result.error));
        } else {
          await this.refreshList(true);
          resolve(result.success);
        }
      });

      try {
        this.ws.sendBinary(buffer);
      } catch (err) {
        this.pending.delete(messageId);
        reject(err);
      }
    });
  }

  delete(scriptId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeCustomScriptDelete(scriptId, messageId);

      this.pending.set(messageId, async (result) => {
        if (result.error) {
          reject(new Error(result.error));
        } else {
          await this.refreshList(true);
          resolve(result.success);
        }
      });

      try {
        this.ws.sendBinary(buffer);
      } catch (err) {
        this.pending.delete(messageId);
        reject(err);
      }
    });
  }

  list(force = false): Promise<CustomScript[]> {
    if (!force && this.scriptsSubject.value.length > 0) {
      return Promise.resolve(this.scriptsSubject.value);
    }
    return this.refreshList(force);
  }

  private refreshList(force = false): Promise<CustomScript[]> {
    if (!force && this.listRequest) {
      if (this.loadingSubject.value) {
        return this.listRequest;
      }
    }

    this.loadingSubject.next(true);
    this.listRequest = new Promise((resolve, reject) => {
      const sendRequest = () => {
        const messageId = generateUUID();
        const buffer = serializeCustomScriptList(messageId);
        const timeoutId = setTimeout(() => {
          if (!this.pending.has(messageId)) return;
          this.pending.delete(messageId);
          this.loadingSubject.next(false);
          this.listRequest = null;
          // Timed out — will retry when connection is re-established via isConnected$ subscription
          resolve(this.scriptsSubject.value);
        }, ScriptService.LIST_TIMEOUT_MS);

        this.pending.set(messageId, (result) => {
          clearTimeout(timeoutId);
          this.loadingSubject.next(false);
          this.listRequest = null;
          if (result.error) {
            reject(new Error(result.error));
          } else {
            this.scriptsSubject.next(result.scripts);
            resolve(result.scripts);
          }
        });

        try {
          this.ws.sendBinary(buffer);
        } catch {
          clearTimeout(timeoutId);
          this.pending.delete(messageId);
          this.loadingSubject.next(false);
          this.listRequest = null;
          resolve(this.scriptsSubject.value);
        }
      };

      if (this.isConnected) {
        sendRequest();
      } else {
        // Not connected yet — wait for the next connection event
        this.loadingSubject.next(false);
        this.listRequest = null;
        resolve(this.scriptsSubject.value);
      }
    });

    return this.listRequest;
  }
}
