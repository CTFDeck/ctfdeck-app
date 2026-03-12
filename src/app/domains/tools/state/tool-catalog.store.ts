import { Injectable, OnDestroy, inject } from '@angular/core';
import { BehaviorSubject, Subscription } from 'rxjs';
import { WebSocketService } from '../../../infrastructure/transport/websocket/websocket.service';
import { MessageType } from '../../../infrastructure/transport/websocket/websocket-message-type.enum';
import { deserializeToolCatalogSnapshot } from '../infrastructure/tools.websocket.protocol';
import type { ToolCatalogItem } from '../models/tool-catalog-item.model';
import { ToolsStore } from './tools.store';

@Injectable({ providedIn: 'root' })
export class ToolCatalogStore implements OnDestroy {
  private readonly webSocketService = inject(WebSocketService);
  private readonly toolsStore = inject(ToolsStore);

  private readonly unregisterHandler: (() => void) | null = null;
  private readonly subscriptions = new Subscription();

  private readonly toolsSubject = new BehaviorSubject<ToolCatalogItem[]>([]);
  readonly tools$ = this.toolsSubject.asObservable();

  constructor() {
    this.unregisterHandler = this.webSocketService.registerHandler((data: Uint8Array) => {
      const type = data[0] as MessageType;

      if (type !== MessageType.ToolCatalogSnapshot) {
        return false;
      }

      const snapshot = deserializeToolCatalogSnapshot(data);
      this.toolsSubject.next(snapshot.tools);
      return true;
    });

    this.subscriptions.add(
      this.toolsStore.tools$.subscribe((inventory) => {
        const current = this.toolsSubject.value;

        if (current.length === 0) {
          return;
        }

        const inventoryById = new Map(inventory.map((tool) => [tool.id.toLowerCase(), tool]));

        const merged = current.map((tool) => {
          const status = inventoryById.get(tool.id.toLowerCase());

          if (!status) {
            return tool;
          }

          return {
            ...tool,
            isInstalled: status.isInstalled,
            isInstallable: status.isInstallable,
            installedPath: status.installedPath,
            version: status.version,
            reason: status.reason,
          };
        });

        this.toolsSubject.next(merged);
      }),
    );
  }

  ngOnDestroy(): void {
    this.unregisterHandler?.();
    this.subscriptions.unsubscribe();
  }
}
