import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { toast } from 'ngx-sonner';
import { provideIcons } from '@ng-icons/core';
import {
  lucideCircleHelp,
  lucideLoader,
  lucidePlay,
  lucidePlus,
  lucideSave,
  lucideSquare,
  lucideTerminal,
  lucideX,
} from '@ng-icons/lucide';
import { BrnSelectImports } from '@spartan-ng/brain/select';
import { BrnDialogImports } from '@spartan-ng/brain/dialog';
import { HlmButtonImports } from '@ctfdeck/helm/button';
import { HlmDialogImports } from '@ctfdeck/helm/dialog';
import { HlmIconImports } from '@ctfdeck/helm/icon';
import { HlmInputImports } from '@ctfdeck/helm/input';
import { HlmLabelImports } from '@ctfdeck/helm/label';

import { TargetService } from '../../../../core/services/target.service';
import { WebSocketService } from '../../../../infrastructure/transport/websocket/websocket.service';
import { SessionStoreService } from '../../../../core/services/session-store.service';
import { ScriptService } from '../../../../core/services/script.service';
import { ToolCatalogStore } from '../../../tools/state/tool-catalog.store';
import {
  ScriptCategory,
  scriptCategoryName,
  type SessionTarget,
} from '../../../../core/services/session.protocol';
import type { ToolCatalogItem } from '../../../tools/models/tool-catalog-item.model';
import type { CommandOption } from '../../models/command-option.model';
import type { CustomScript } from '../../models/custom-script.model';
import type { ScriptForm } from '../../models/script-form.model';
import {
  applyPendingSelection,
  buildCommandFromTemplate,
  buildCommandOptions,
  findScriptTemplate,
  findToolTemplate,
  getSelectedCommandId,
  hasSelectedCommand,
} from '../../utils/command-runner-template.utils';
import {
  ansiToSafeHtml,
  appendErrorToLastOutput,
  createAnsiConverter,
  errorMessageOf,
  toSafeHtml,
} from '../../utils/command-runner-render.utils';

@Component({
  selector: 'app-command-runner',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ...BrnSelectImports,
    ...BrnDialogImports,
    ...HlmButtonImports,
    ...HlmInputImports,
    ...HlmIconImports,
    ...HlmLabelImports,
    ...HlmDialogImports,
  ],
  providers: [
    provideIcons({
      lucideTerminal,
      lucideX,
      lucideSave,
      lucidePlay,
      lucideSquare,
      lucideLoader,
      lucideCircleHelp,
      lucidePlus,
    }),
  ],
  templateUrl: './command-runner.component.html',
  styleUrl: './command-runner.component.css',
})
export class CommandRunnerComponent implements OnInit, OnDestroy, OnChanges {
  @Output() closeEvent = new EventEmitter<void>();
  @Input() initialToolId = '';

  @ViewChild('outputContainer') private outputContainer!: ElementRef;

  private readonly targetService = inject(TargetService);
  private readonly wsService = inject(WebSocketService);
  private readonly sessionStore = inject(SessionStoreService);
  private readonly scriptService = inject(ScriptService);
  private readonly toolCatalogStore = inject(ToolCatalogStore);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly sanitizer = inject(DomSanitizer);

  targets: SessionTarget[] = [];
  selectedTargetId = '';
  selectedToolId = '';
  selectedScriptId = '';
  currentCommand = '';
  isRunning = false;
  isSessionEnsuring = false;

  outputLines: SafeHtml[] = [];

  isHelpRunning = false;
  helpOutput: SafeHtml | null = null;

  tools: ToolCatalogItem[] = [];
  commandOptions: CommandOption[] = [];
  customScripts: CustomScript[] = [];
  customScriptsLoading = false;
  showManageScripts = false;
  editingScriptId: string | null = null;
  scriptForm: ScriptForm = {
    name: '',
    category: ScriptCategory.Other,
    template: '',
  };

  private pendingInitialSelection: string | null = null;
  private readonly subscriptions = new Subscription();
  private readonly ansiConverter = createAnsiConverter();

  readonly scriptCategoryOptions = [
    { value: ScriptCategory.Discovery, label: scriptCategoryName(ScriptCategory.Discovery) },
    { value: ScriptCategory.Web, label: scriptCategoryName(ScriptCategory.Web) },
    { value: ScriptCategory.ReverseShell, label: scriptCategoryName(ScriptCategory.ReverseShell) },
    { value: ScriptCategory.Exploit, label: scriptCategoryName(ScriptCategory.Exploit) },
    { value: ScriptCategory.Other, label: scriptCategoryName(ScriptCategory.Other) },
  ];

  ngOnInit(): void {
    this.subscriptions.add(
      this.sessionStore.activeSession$.subscribe((session) => {
        this.targets = session?.targets || [];

        if (this.selectedTargetId && !this.targets.find((target) => target.id === this.selectedTargetId)) {
          this.selectedTargetId = '';
        }

        this.updateCommandPreview();
      }),
    );

    this.subscriptions.add(
      this.toolCatalogStore.tools$.subscribe((tools) => {
        this.tools = tools.filter((tool) => tool.kind === 'binary');
        this.rebuildCommandOptions();
        this.applyPendingSelection();
        this.updateCommandPreview();
        this.cdr.detectChanges();
      }),
    );

    this.subscriptions.add(
      this.scriptService.scripts$.subscribe((scripts) => {
        this.customScripts = scripts;
        this.rebuildCommandOptions();
        this.applyPendingSelection();
        this.updateCommandPreview();
        this.cdr.detectChanges();
      }),
    );

    this.subscriptions.add(
      this.scriptService.isLoading$.subscribe((loading) => {
        this.customScriptsLoading = loading;
      }),
    );

    this.rebuildCommandOptions();
    void this.scriptService.list();

    if (this.initialToolId) {
      this.pendingInitialSelection = this.initialToolId;
      this.applyPendingSelection();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialToolId']?.currentValue) {
      const value = changes['initialToolId'].currentValue as string;

      if (value === '__manage_scripts__') {
        this.showManageScripts = true;
        return;
      }

      this.pendingInitialSelection = value;
      this.applyPendingSelection();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  close(): void {
    this.closeEvent.emit();
  }

  onTargetChange(): void {
    this.updateCommandPreview();
  }

  selectCommandOption(option: CommandOption): void {
    if (option.kind === 'tool') {
      this.selectTool(option.id);
      return;
    }

    this.selectScript(option.id);
  }

  isCommandSelected(option: CommandOption): boolean {
    return option.kind === 'tool'
      ? this.selectedToolId === option.id
      : this.selectedScriptId === option.id;
  }

  selectTool(toolId: string): void {
    this.selectedToolId = toolId;
    this.selectedScriptId = '';
    this.updateCommandPreview();
  }

  selectScript(scriptId: string): void {
    this.selectedScriptId = scriptId;
    this.selectedToolId = '';
    this.updateCommandPreview();
  }

  updateCommandPreview(): void {
    if (!this.selectedTargetId || !hasSelectedCommand(this.selectedToolId, this.selectedScriptId)) {
      this.currentCommand = '';
      return;
    }

    const target = this.targets.find((item) => item.id === this.selectedTargetId);

    if (!target) {
      this.currentCommand = '';
      return;
    }

    const selectedId = getSelectedCommandId(this.selectedToolId, this.selectedScriptId);
    const savedCommand = this.targetService.getSavedCommand(target.id, selectedId);

    if (savedCommand) {
      this.currentCommand = savedCommand;
      return;
    }

    const template = this.selectedToolId
      ? findToolTemplate(this.tools, this.selectedToolId)
      : findScriptTemplate(this.customScripts, this.selectedScriptId);

    if (!template) {
      this.currentCommand = '';
      return;
    }

    this.currentCommand = buildCommandFromTemplate(target, template);
  }

  saveCommand(): void {
    const selectedId = getSelectedCommandId(this.selectedToolId, this.selectedScriptId);

    if (this.selectedTargetId && selectedId && this.currentCommand) {
      this.targetService.saveTargetCommand(
        this.selectedTargetId,
        selectedId,
        this.currentCommand,
      );
    }
  }

  async runCommand(): Promise<void> {
    if (!this.currentCommand) {
      return;
    }

    this.isRunning = true;
    this.outputLines = [];
    this.addLine(`<span class="text-blue-400">Running: ${this.currentCommand}</span>`);

    if (!(await this.ensureActiveSession())) {
      this.isRunning = false;
      return;
    }

    let outputLineIndex = -1;
    let outputBuffer = '';
    let errorBuffer = '';
    let pendingRender = false;
    let lastRenderTime = 0;
    const minRenderInterval = 16;

    const scheduleRender = () => {
      if (pendingRender) {
        return;
      }

      const now = performance.now();

      if (now - lastRenderTime < minRenderInterval) {
        pendingRender = true;

        requestAnimationFrame(() => {
          pendingRender = false;
          lastRenderTime = performance.now();
          this.renderOutputBuffer(outputLineIndex, outputBuffer);
        });

        return;
      }

      lastRenderTime = now;
      this.renderOutputBuffer(outputLineIndex, outputBuffer);
    };

    this.sessionStore.broadcastTerminalEvent({
      type: 'command',
      content: `${this.currentCommand}`,
    });

    this.wsService
      .executeCommandStreaming(
        this.currentCommand,
        (data: string) => {
          outputBuffer += data;

          if (outputLineIndex === -1) {
            outputLineIndex = this.outputLines.length;
            this.outputLines.push(toSafeHtml(this.sanitizer, ''));
          }

          this.sessionStore.broadcastTerminalEvent({ type: 'output', content: data });
          scheduleRender();
        },
        (data: string) => {
          errorBuffer += data;
          this.sessionStore.broadcastTerminalEvent({ type: 'error', content: data });
          this.appendToLastError(data);
        },
      )
      .then((result) => {
        if (outputLineIndex >= 0) {
          this.renderOutputBuffer(outputLineIndex, outputBuffer);
        }

        this.isRunning = false;
        this.addLine(`<span class="text-green-400">Done. Exit code: ${result.exitCode}</span>`);
        this.cdr.detectChanges();
        void this.sessionStore.refreshActiveSession();
      })
      .catch((error: unknown) => {
        this.isRunning = false;
        this.addLine(`<span class="text-red-500">Error: ${errorMessageOf(error)}</span>`);
        this.cdr.detectChanges();
      });
  }

  stopCommand(): void {
    this.isRunning = false;
    this.addLine(`<span class="text-yellow-500">Stop requested (UI only)</span>`);
  }

  clearOutput(): void {
    this.outputLines = [];
  }

  runHelp(): void {
    if (!this.selectedToolId) {
      return;
    }

    this.isHelpRunning = true;
    this.helpOutput = null;

    let outputBuffer = '';
    let errorBuffer = '';
    let pendingRender = false;
    let lastRenderTime = 0;
    const minRenderInterval = 16;

    const scheduleRender = () => {
      if (pendingRender) {
        return;
      }

      const now = performance.now();

      if (now - lastRenderTime < minRenderInterval) {
        pendingRender = true;

        requestAnimationFrame(() => {
          pendingRender = false;
          lastRenderTime = performance.now();
          this.renderHelpOutput(outputBuffer);
        });

        return;
      }

      lastRenderTime = now;
      this.renderHelpOutput(outputBuffer);
    };

    this.wsService
      .executeCommandStreaming(
        `${this.selectedToolId} -h`,
        (data: string) => {
          outputBuffer += data;
          scheduleRender();
        },
        (error: string) => {
          errorBuffer += error;
        },
      )
      .then(() => {
        this.isHelpRunning = false;
        this.renderHelpOutput(outputBuffer || errorBuffer);
        this.cdr.detectChanges();
      })
      .catch((error: unknown) => {
        this.isHelpRunning = false;
        this.helpOutput = toSafeHtml(
          this.sanitizer,
          `<span class="text-red-500">Error running help: ${errorMessageOf(error)}</span>`,
        );
        this.cdr.detectChanges();
      });
  }

  get canShowHelp(): boolean {
    return !!this.selectedToolId;
  }

  openManageScripts(): void {
    this.showManageScripts = true;
    this.resetScriptForm();
  }

  closeManageScripts(): void {
    this.showManageScripts = false;
    this.resetScriptForm();
  }

  editScript(script: CustomScript): void {
    this.editingScriptId = script.id;
    this.scriptForm = {
      name: script.name,
      category: script.category as ScriptCategory,
      template: script.template,
    };
    this.showManageScripts = true;
  }

  async saveScript(): Promise<void> {
    const name = this.scriptForm.name.trim();
    const template = this.scriptForm.template.trim();

    if (!name || !template) {
      toast.error('Missing fields', { description: 'Name and template are required.' });
      return;
    }

    try {
      if (this.editingScriptId) {
        await this.scriptService.update(
          this.editingScriptId,
          name,
          this.scriptForm.category,
          template,
        );
        toast.success('Script updated');
      } else {
        await this.scriptService.create(
          name,
          this.scriptForm.category,
          template,
        );
        toast.success('Script created');
      }

      this.resetScriptForm();
    } catch (error: unknown) {
      toast.error('Script operation failed', {
        description: errorMessageOf(error) || 'Unknown error',
      });
    }
  }

  async deleteScript(scriptId: string): Promise<void> {
    try {
      await this.scriptService.delete(scriptId);
      toast.success('Script deleted');

      if (this.selectedScriptId === scriptId) {
        this.selectedScriptId = '';
        this.currentCommand = '';
      }
    } catch (error: unknown) {
      toast.error('Delete failed', {
        description: errorMessageOf(error) || 'Unknown error',
      });
    }
  }

  getScriptCategoryLabel(category: number): string {
    return this.scriptCategoryOptions.find((option) => option.value === category)?.label || 'Unknown';
  }

  resetScriptForm(): void {
    this.editingScriptId = null;
    this.scriptForm = {
      name: '',
      category: ScriptCategory.Other,
      template: '',
    };
  }

  private rebuildCommandOptions(): void {
    this.commandOptions = buildCommandOptions(this.tools, this.customScripts);
  }

  private applyPendingSelection(): void {
    const selection = applyPendingSelection(
      this.pendingInitialSelection,
      this.tools,
      this.customScripts,
    );

    switch (selection.type) {
      case 'manage-scripts':
        this.showManageScripts = true;
        this.pendingInitialSelection = null;
        return;
      case 'tool':
        this.selectTool(selection.value!);
        this.pendingInitialSelection = null;
        return;
      case 'script':
        this.selectScript(selection.value!);
        this.pendingInitialSelection = null;
        return;
      default:
        return;
    }
  }

  private async ensureActiveSession(): Promise<boolean> {
    this.isSessionEnsuring = true;

    try {
      await this.sessionStore.ensureActiveSession();
      return true;
    } catch (error: unknown) {
      this.addLine(
        `<span class="text-red-500">Session error: ${errorMessageOf(error)}</span>`,
      );
      return false;
    } finally {
      this.isSessionEnsuring = false;
      this.cdr.detectChanges();
    }
  }

  private renderOutputBuffer(lineIndex: number, buffer: string): void {
    if (lineIndex < 0 || lineIndex >= this.outputLines.length) {
      return;
    }

    this.outputLines[lineIndex] = ansiToSafeHtml(
      this.ansiConverter,
      this.sanitizer,
      buffer,
    );

    this.cdr.detectChanges();
    this.scrollToBottom();
  }

  private renderHelpOutput(buffer: string): void {
    this.helpOutput = ansiToSafeHtml(
      this.ansiConverter,
      this.sanitizer,
      buffer,
    );

    this.cdr.detectChanges();
  }

  private appendToLastError(data: string): void {
    this.outputLines = appendErrorToLastOutput(
      this.outputLines,
      this.sanitizer,
      data,
    );

    this.cdr.detectChanges();
  }

  private addLine(htmlContent: string): void {
    this.outputLines.push(toSafeHtml(this.sanitizer, htmlContent));
    this.cdr.detectChanges();
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      if (this.outputContainer) {
        this.outputContainer.nativeElement.scrollTop =
          this.outputContainer.nativeElement.scrollHeight;
      }
    }, 0);
  }
}
