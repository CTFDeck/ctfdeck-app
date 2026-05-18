import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription, distinctUntilChanged, filter } from 'rxjs';
import { HlmButtonImports } from '@ctfdeck/helm/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCheckCheck,
  lucideClock3,
  lucideDownload,
  lucideListX,
  lucideLoaderCircle,
  lucidePackageSearch,
  lucideRefreshCw,
  lucideTrash2,
  lucideWrench,
  lucideX,
} from '@ng-icons/lucide';
import { HlmSpinner } from '@ctfdeck/helm/spinner';

import { MessageType } from '../../../../infrastructure/transport/websocket/websocket-message-type.enum';
import { WebSocketService } from '../../../../infrastructure/transport/websocket/websocket.service';
import type { ToolInstallProgress } from '../../models/tool-install-progress.model';
import { ToolInstallState } from '../../models/tool-install-state.enum';
import type { ToolStatus } from '../../models/tool-status.model';
import { ToolsStore } from '../../state/tools.store';
import {
  TOOL_INSTALL_DISMISSED_STORAGE_KEY,
  buildVisibleToolIds,
  computeInstallingState,
  getInstallableVisibleTools,
  getToolInstallStateLabel,
  hasMissingInstallableTools,
  isToolSelectable,
} from './tool-install-modal.utils';
import { HlmIcon } from '@ctfdeck/helm/icon';
import { TranslatePipe } from '../../../../shell/menubar/translate.pipe';
import { I18nService } from '../../../../shell/menubar/i18n.service';

@Component({
  selector: 'app-tool-install-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIcon, HlmButtonImports, HlmSpinner, HlmIcon, TranslatePipe],
  providers: [
    provideIcons({
      lucideWrench,
      lucideX,
      lucideRefreshCw,
      lucideLoaderCircle,
      lucidePackageSearch,
      lucideDownload,
      lucideCheckCheck,
      lucideListX,
      lucideClock3,
      lucideTrash2,
    }),
  ],
  templateUrl: './tool-install-modal.component.html',
  styleUrl: './tool-install-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToolInstallModalComponent implements OnInit, OnDestroy {
  private readonly toolsStore = inject(ToolsStore);
  private readonly webSocketService = inject(WebSocketService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly i18n = inject(I18nService);

  @Output() closed = new EventEmitter<void>();

  visible = false;
  loadingInventory = false;
  installing = false;

  tools: ToolStatus[] = [];
  selectedToolIds: Record<string, boolean> = {};
  progressByToolId: Record<string, ToolInstallProgress> = {};
  errorMessage: string | null = null;

  readonly toolInstallState = ToolInstallState;

  private readonly subscriptions = new Subscription();
  private inventoryRequestedOnce = false;
  private visibleToolIds = new Set<string>();

  get installableTools(): ToolStatus[] {
    return getInstallableVisibleTools(this.tools, this.visibleToolIds);
  }

  ngOnInit(): void {
    this.subscriptions.add(
      this.webSocketService.isConnected$
        .pipe(
          distinctUntilChanged(),
          filter((connected) => connected),
        )
        .subscribe(() => {
          if (!this.inventoryRequestedOnce) {
            this.inventoryRequestedOnce = true;
            this.toolsStore.requestInventory();
          }
        }),
    );

    this.subscriptions.add(
      this.toolsStore.tools$.subscribe((tools) => {
        this.tools = tools;

        for (const tool of tools) {
          if (this.selectedToolIds[tool.id] === undefined) {
            this.selectedToolIds[tool.id] = false;
          }
        }

        const wasVisible = this.visible;
        if (!wasVisible) {
          const isDismissed = localStorage.getItem(TOOL_INSTALL_DISMISSED_STORAGE_KEY) === 'true';
          this.visible = !isDismissed && hasMissingInstallableTools(tools);
        } else {
          this.visible = true;
        }

        if (!wasVisible && this.visible) {
          this.visibleToolIds = buildVisibleToolIds(tools);
          this.refresh();
        }

        this.installing = computeInstallingState(this.progressByToolId);
        this.cdr.markForCheck();
      }),
    );

    this.subscriptions.add(
      this.toolsStore.loadingInventory$.subscribe((loading) => {
        this.loadingInventory = loading;
        this.cdr.markForCheck();
      }),
    );

    this.subscriptions.add(
      this.toolsStore.installing$.subscribe((installing) => {
        this.installing = installing;
        this.cdr.markForCheck();
      }),
    );

    this.subscriptions.add(
      this.toolsStore.progress$.subscribe((progress) => {
        this.progressByToolId[progress.toolId] = progress;

        if (progress.state === ToolInstallState.Success && progress.installedPath) {
          this.tools = this.tools.map((tool) =>
            tool.id === progress.toolId
              ? { ...tool, isInstalled: true, installedPath: progress.installedPath }
              : tool,
          );
        }

        this.installing = computeInstallingState(this.progressByToolId);
        this.cdr.markForCheck();
      }),
    );

    this.subscriptions.add(
      this.toolsStore.error$.subscribe((error) => {
        this.errorMessage = error;
        this.installing = false;
        this.cdr.markForCheck();
      }),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  forceOpen(): void {
    this.visibleToolIds = buildVisibleToolIds(this.tools);
    this.visible = true;
    this.refresh();
    this.cdr.markForCheck();
  }

  close(): void {
    if (this.installing) {
      return;
    }

    this.visible = false;
    this.closed.emit();
  }

  dismiss(): void {
    localStorage.setItem(TOOL_INSTALL_DISMISSED_STORAGE_KEY, 'true');
    this.close();
  }

  refresh(): void {
    this.errorMessage = null;
    this.progressByToolId = {};
    this.toolsStore.refresh();
  }

  installSelected(): void {
    this.errorMessage = null;

    const selectedToolIds = this.installableTools
      .filter((tool) => this.isSelectable(tool) && this.selectedToolIds[tool.id])
      .map((tool) => tool.id);

    if (selectedToolIds.length === 0) {
      this.errorMessage = this.i18n.translate('tools.error.selectAtLeastOne');
      this.cdr.markForCheck();
      return;
    }

    this.toolsStore.installTools(selectedToolIds);
  }

  uninstallTool(toolId: string): void {
    this.errorMessage = null;

    this.progressByToolId[toolId] = {
      type: MessageType.ToolInstallProgress,
      messageId: '',
      toolId: toolId,
      state: ToolInstallState.Uninstalling,
      message: 'Requesting uninstallation...',
      progressPercent: null,
      installedPath: null,
      error: null,
    };

    this.toolsStore.uninstallTools([toolId]);
  }

  shouldShowProgress(tool: ToolStatus): ToolInstallProgress | null {
    const progress = this.progressByToolId[tool.id];
    if (!progress) {
      return null;
    }

    return progress.state !== ToolInstallState.Success ? progress : null;
  }

  toggleAll(select: boolean): void {
    for (const tool of this.installableTools) {
      if (this.isSelectable(tool)) {
        this.selectedToolIds[tool.id] = select;
      }
    }

    this.cdr.markForCheck();
  }

  isSelectable(tool: ToolStatus): boolean {
    return isToolSelectable(tool);
  }

  getSelectedCount(): number {
    return this.installableTools.filter(
      (tool) => this.isSelectable(tool) && this.selectedToolIds[tool.id],
    ).length;
  }

  getProgressLabel(toolId: string): string {
    const progress = this.progressByToolId[toolId];

    if (!progress) {
      return '';
    }

    if (progress.error) {
      return progress.error;
    }

    return progress.message ?? '';
  }

  getStateLabel(state: ToolInstallState): string {
    return getToolInstallStateLabel(state, (key) => this.i18n.translate(key));
  }
}