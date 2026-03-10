import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subscription } from 'rxjs';
import { WebSocketService } from './websocket.service';
import { deserializeToolCatalogSnapshot, MessageType, ToolCatalogItem } from './websocket.protocol';
import { ToolsService } from './tools.service';

@Injectable({ providedIn: 'root' })
export class ToolCatalogService implements OnDestroy {
  private unregisterHandler: (() => void) | null = null;
  private subscriptions = new Subscription();

  private readonly toolsSubject = new BehaviorSubject<ToolCatalogItem[]>([]);
  readonly tools$ = this.toolsSubject.asObservable();

  constructor(
    private readonly webSocketService: WebSocketService,
    private readonly toolsService: ToolsService,
  ) {
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
      this.toolsService.tools$.subscribe((inventory) => {
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

  getCurrentTools(): ToolCatalogItem[] {
    return this.toolsSubject.value;
  }
}
