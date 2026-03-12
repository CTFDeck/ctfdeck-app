import { Injectable, NgZone, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { WebSocketService } from '../../../infrastructure/transport/websocket/websocket.service';
import { generateUUID } from '../../../infrastructure/transport/websocket/websocket-uuid.utils';
import { MessageType } from '../../../infrastructure/transport/websocket/websocket-message-type.enum';
import type { Script } from '../models/script.model';
import {
  deserializeCustomScriptCreateResult,
  deserializeCustomScriptDeleteResult,
  deserializeCustomScriptListResult,
  deserializeCustomScriptOperationError,
  deserializeCustomScriptUpdateResult,
  isCustomScriptResponse,
  serializeCustomScriptCreate,
  serializeCustomScriptDelete,
  serializeCustomScriptList,
  serializeCustomScriptUpdate,
} from '../infrastructure/script.websocket.protocol';

type PendingResult =
  | { messageId: string; success: boolean; scriptId: string }
  | { messageId: string; success: boolean }
  | { messageId: string; scripts: Script[] }
  | { messageId: string; error: string };

@Injectable({ providedIn: 'root' })
export class ScriptStore {
  private readonly ws = inject(WebSocketService);
  private readonly zone = inject(NgZone);

  private static readonly LIST_TIMEOUT_MS = 5000;

  private readonly scriptsSubject = new BehaviorSubject<Script[]>([]);
  readonly scripts$ = this.scriptsSubject.asObservable();

  private readonly loadingSubject = new BehaviorSubject<boolean>(false);
  readonly isLoading$ = this.loadingSubject.asObservable();

  private readonly pending = new Map<string, (result: PendingResult) => void>();
  private listRequest: Promise<Script[]> | null = null;
  private isConnected = false;

  constructor() {
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

  create(
    name: string,
    category: number,
    template: string,
  ): Promise<{ success: boolean; scriptId: string }> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeCustomScriptCreate(name, category, template, messageId);

      this.sendRequest(
        messageId,
        buffer,
        async (result) => {
          await this.refreshList(true);

          resolve({
            success: 'success' in result ? result.success : false,
            scriptId: 'scriptId' in result ? result.scriptId : '',
          });
        },
        reject,
      );
    });
  }

  update(scriptId: string, name: string, category: number, template: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeCustomScriptUpdate(scriptId, name, category, template, messageId);

      this.sendRequest(
        messageId,
        buffer,
        async (result) => {
          await this.refreshList(true);
          resolve('success' in result ? result.success : false);
        },
        reject,
      );
    });
  }

  delete(scriptId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeCustomScriptDelete(scriptId, messageId);

      this.sendRequest(
        messageId,
        buffer,
        async (result) => {
          await this.refreshList(true);
          resolve('success' in result ? result.success : false);
        },
        reject,
      );
    });
  }

  list(force = false): Promise<Script[]> {
    if (!force && this.scriptsSubject.value.length > 0) {
      return Promise.resolve(this.scriptsSubject.value);
    }

    return this.refreshList(force);
  }

  private sendRequest(
    messageId: string,
    buffer: Uint8Array,
    onSuccess: (result: PendingResult) => void,
    reject: (err: any) => void,
  ): void {
    this.pending.set(messageId, async (result) => {
      if ('error' in result) {
        reject(new Error(result.error));
        return;
      }

      await onSuccess(result);
    });

    try {
      this.ws.sendBinary(buffer);
    } catch (error) {
      this.pending.delete(messageId);
      reject(error);
    }
  }

  private refreshList(force = false): Promise<Script[]> {
    if (!force && this.listRequest && this.loadingSubject.value) {
      return this.listRequest;
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
          resolve(this.scriptsSubject.value);
        }, ScriptStore.LIST_TIMEOUT_MS);

        this.pending.set(messageId, (result) => {
          clearTimeout(timeoutId);
          this.loadingSubject.next(false);
          this.listRequest = null;

          if ('error' in result) {
            reject(new Error(result.error));
            return;
          }

          const scripts = 'scripts' in result ? result.scripts : [];
          this.scriptsSubject.next(scripts);
          resolve(scripts);
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
        this.loadingSubject.next(false);
        this.listRequest = null;
        resolve(this.scriptsSubject.value);
      }
    });

    return this.listRequest;
  }

  private handleMessage(data: Uint8Array): boolean {
    const type = data[0];

    if (!isCustomScriptResponse(type)) {
      return false;
    }

    let result: PendingResult;

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
}
