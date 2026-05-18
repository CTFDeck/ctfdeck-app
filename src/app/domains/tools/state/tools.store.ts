import { Injectable, OnDestroy, inject } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { WebSocketService } from '../../../infrastructure/transport/websocket/websocket.service';
import { MessageType } from '../../../infrastructure/transport/websocket/websocket-message-type.enum';
import { generateUUID } from '../../../infrastructure/transport/websocket/websocket-uuid.utils';
import {
  deserializeToolInstallAccepted,
  deserializeToolInstallProgress,
  deserializeToolInventoryResult,
  deserializeToolOperationError,
  deserializeToolUninstallAccepted,
  serializeToolInstallRequest,
  serializeToolInventoryRequest,
  serializeToolUninstallRequest,
  type ToolInstallAccepted,
  type ToolUninstallAccepted,
} from '../infrastructure/tools.websocket.protocol';
import type { ToolInstallProgress } from '../models/tool-install-progress.model';
import { ToolInstallState } from '../models/tool-install-state.enum';
import type { ToolStatus } from '../models/tool-status.model';

@Injectable({ providedIn: 'root' })
export class ToolsStore implements OnDestroy {
  private readonly webSocketService = inject(WebSocketService);

  private unregisterHandler: (() => void) | null = null;

  private readonly toolsSubject = new BehaviorSubject<ToolStatus[]>([]);
  readonly tools$ = this.toolsSubject.asObservable();

  private readonly installAcceptedSubject = new Subject<ToolInstallAccepted>();
  private readonly uninstallAcceptedSubject = new Subject<ToolUninstallAccepted>();

  private readonly progressSubject = new Subject<ToolInstallProgress>();
  readonly progress$ = this.progressSubject.asObservable();

  private readonly errorSubject = new Subject<string>();
  readonly error$ = this.errorSubject.asObservable();

  private readonly loadingInventorySubject = new BehaviorSubject<boolean>(false);
  readonly loadingInventory$ = this.loadingInventorySubject.asObservable();

  private readonly installingSubject = new BehaviorSubject<boolean>(false);
  readonly installing$ = this.installingSubject.asObservable();

  constructor() {
    this.registerProtocolHandler();
  }

  ngOnDestroy(): void {
    this.unregisterHandler?.();
  }

  requestInventory(): string {
    const messageId = generateUUID();
    this.loadingInventorySubject.next(true);
    this.webSocketService.sendBinary(serializeToolInventoryRequest(messageId));
    return messageId;
  }

  installTools(toolIds: string[]): string {
    const sanitized = toolIds.map((id) => id.trim()).filter((id) => id.length > 0);

    if (sanitized.length === 0) {
      throw new Error('No tool selected for installation');
    }

    const messageId = generateUUID();
    this.installingSubject.next(true);
    this.webSocketService.sendBinary(serializeToolInstallRequest(sanitized, messageId));
    return messageId;
  }

  uninstallTools(toolIds: string[]): string {
    const sanitized = toolIds.map((id) => id.trim()).filter((id) => id.length > 0);

    if (sanitized.length === 0) {
      throw new Error('No tool selected for uninstallation');
    }

    const messageId = generateUUID();
    this.installingSubject.next(true);
    this.webSocketService.sendBinary(serializeToolUninstallRequest(sanitized, messageId));
    return messageId;
  }

  refresh(): void {
    this.requestInventory();
  }

  private registerProtocolHandler(): void {
    if (this.unregisterHandler) {
      return;
    }

    this.unregisterHandler = this.webSocketService.registerHandler((data: Uint8Array) => {
      const type = data[0] as MessageType;

      switch (type) {
        case MessageType.ToolInventoryResult: {
          const result = deserializeToolInventoryResult(data);
          this.toolsSubject.next(result.tools);
          this.loadingInventorySubject.next(false);
          this.installingSubject.next(false);
          return true;
        }

        case MessageType.ToolInstallAccepted: {
          const result = deserializeToolInstallAccepted(data);
          this.installAcceptedSubject.next(result);

          if (!result.success) {
            this.installingSubject.next(false);
          }

          return true;
        }

        case MessageType.ToolUninstallAccepted: {
          const result = deserializeToolUninstallAccepted(data);
          this.uninstallAcceptedSubject.next(result);

          if (!result.success) {
            this.installingSubject.next(false);
          }

          return true;
        }

        case MessageType.ToolInstallProgress: {
          const result = deserializeToolInstallProgress(data);
          this.progressSubject.next(result);

          if (
            result.state === ToolInstallState.Failed ||
            result.state === ToolInstallState.Success
          ) { /*Ignore*/ }

          return true;
        }

        case MessageType.ToolOperationError: {
          const result = deserializeToolOperationError(data);
          this.errorSubject.next(result.error);
          this.loadingInventorySubject.next(false);
          this.installingSubject.next(false);
          return true;
        }

        default:
          return false;
      }
    });
  }
}
