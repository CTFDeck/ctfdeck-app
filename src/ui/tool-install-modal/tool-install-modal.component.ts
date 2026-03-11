import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription, distinctUntilChanged, filter } from 'rxjs';
import { HlmButtonImports } from '@ctfdeck/helm/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideWrench,
  lucideX,
  lucideRefreshCw,
  lucideLoaderCircle,
  lucidePackageSearch,
  lucideDownload,
} from '@ng-icons/lucide';
import { HlmSpinner } from '@ctfdeck/helm/spinner';

import { ToolsStore } from '../../app/domains/tools/state/tools.store';
import { WebSocketService } from '../../app/infrastructure/transport/websocket/websocket.service';
import { ToolStatus } from '../../app/domains/tools/models/tool-status.model';
import { ToolInstallState } from '../../app/domains/tools/models/tool-install-state.enum';
import { ToolInstallProgress } from '../../app/domains/tools/infrastructure/tools.websocket.protocol';

@Component({
  selector: 'app-tool-install-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIcon, HlmButtonImports, HlmSpinner],
  providers: [
    provideIcons({
      lucideWrench,
      lucideX,
      lucideRefreshCw,
      lucideLoaderCircle,
      lucidePackageSearch,
      lucideDownload,
    }),
  ],
  templateUrl: './tool-install-modal.component.html',
  styleUrl: './tool-install-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToolInstallModalComponent implements OnInit, OnDestroy {
  @Output() closed = new EventEmitter<void>();

  visible = false;
  loadingInventory = false;
  installing = false;

  tools: ToolStatus[] = [];
  selectedToolIds: Record<string, boolean> = {};
  progressByToolId: Record<string, ToolInstallProgress> = {};
  errorMessage: string | null = null;

  readonly toolInstallState = ToolInstallState;

  private readonly STORAGE_KEY_DISMISSED = 'ctfdeck_tool_install_dismissed';
  private readonly subscriptions = new Subscription();
  private inventoryRequestedOnce = false;
  private visibleToolIds = new Set<string>();

  constructor(
    private readonly ToolsStore: ToolsStore,
    private readonly webSocketService: WebSocketService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  get installableTools(): ToolStatus[] {
    return this.tools.filter((tool) => tool.kind === 'binary' && this.visibleToolIds.has(tool.id));
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
            this.ToolsStore.requestInventory();
          }
        }),
    );

    this.subscriptions.add(
      this.ToolsStore.tools$.subscribe((tools) => {
        this.tools = tools;

        for (const tool of tools) {
          if (this.selectedToolIds[tool.id] === undefined) {
            this.selectedToolIds[tool.id] = false;
          }
        }

        const wasVisible = this.visible;
        const isDismissed = localStorage.getItem(this.STORAGE_KEY_DISMISSED) === 'true';
        this.visible = !isDismissed && this.hasMissingInstallableTools(tools);

        if (!wasVisible && this.visible) {
          this.visibleToolIds = new Set(
            tools.filter((t) => t.kind === 'binary' && !t.isInstalled).map((t) => t.id),
          );
        }

        this.installing = this.computeInstallingState();
        this.cdr.markForCheck();
      }),
    );

    this.subscriptions.add(
      this.ToolsStore.loadingInventory$.subscribe((loading) => {
        this.loadingInventory = loading;
        this.cdr.markForCheck();
      }),
    );

    this.subscriptions.add(
      this.ToolsStore.installing$.subscribe((installing) => {
        this.installing = installing;
        this.cdr.markForCheck();
      }),
    );

    this.subscriptions.add(
      this.ToolsStore.progress$.subscribe((progress) => {
        this.progressByToolId[progress.toolId] = progress;

        if (progress.state === ToolInstallState.Success && progress.installedPath) {
          this.tools = this.tools.map((tool) =>
            tool.id === progress.toolId
              ? { ...tool, isInstalled: true, installedPath: progress.installedPath }
              : tool,
          );
        }

        this.installing = this.computeInstallingState();
        this.cdr.markForCheck();
      }),
    );

    this.subscriptions.add(
      this.ToolsStore.error$.subscribe((error) => {
        this.errorMessage = error;
        this.installing = false;
        this.cdr.markForCheck();
      }),
    );
  }

  forceOpen(): void {
    this.visibleToolIds = new Set(
      this.tools.filter((t) => t.kind === 'binary' && !t.isInstalled).map((t) => t.id),
    );
    this.visible = true;
    this.cdr.markForCheck();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  close(): void {
    if (this.installing) {
      return;
    }

    this.visible = false;
    this.closed.emit();
  }

  dismiss(): void {
    localStorage.setItem(this.STORAGE_KEY_DISMISSED, 'true');
    this.close();
  }

  refresh(): void {
    this.errorMessage = null;
    this.ToolsStore.refresh();
  }

  installSelected(): void {
    this.errorMessage = null;

    const selectedToolIds = this.installableTools
      .filter((tool) => this.isSelectable(tool) && this.selectedToolIds[tool.id])
      .map((tool) => tool.id);

    if (selectedToolIds.length === 0) {
      this.errorMessage = 'Select at least one tool.';
      this.cdr.markForCheck();
      return;
    }

    this.ToolsStore.installTools(selectedToolIds);
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
    return !tool.isInstalled && tool.isInstallable;
  }

  getSelectedCount(): number {
    return this.installableTools.filter(
      (tool) => this.isSelectable(tool) && this.selectedToolIds[tool.id],
    ).length;
  }

  getProgressPercent(toolId: string): number | null {
    const progress = this.progressByToolId[toolId];
    return progress?.progressPercent ?? null;
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
    switch (state) {
      case ToolInstallState.Pending:
        return 'Pending';
      case ToolInstallState.Downloading:
        return 'Downloading';
      case ToolInstallState.Extracting:
        return 'Extracting';
      case ToolInstallState.Installing:
        return 'Installing';
      case ToolInstallState.Verifying:
        return 'Verifying';
      case ToolInstallState.Success:
        return 'Success';
      case ToolInstallState.Failed:
        return 'Failed';
      default:
        return 'Unknown';
    }
  }

  trackByToolId(_: number, tool: ToolStatus): string {
    return tool.id;
  }

  private hasMissingInstallableTools(tools: ToolStatus[]): boolean {
    return tools.some((tool) => tool.kind === 'binary' && !tool.isInstalled && tool.isInstallable);
  }

  private computeInstallingState(): boolean {
    return Object.values(this.progressByToolId).some(
      (progress) =>
        progress.state !== ToolInstallState.Success && progress.state !== ToolInstallState.Failed,
    );
  }
}
