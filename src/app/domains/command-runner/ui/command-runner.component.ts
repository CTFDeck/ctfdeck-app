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
  lucideActivity,
} from '@ng-icons/lucide';
import { BrnSelect, BrnSelectImports } from '@spartan-ng/brain/select';
import { BrnDialogContent, BrnDialogImports, BrnDialogTrigger } from '@spartan-ng/brain/dialog';
import { HlmButtonImports } from '@ctfdeck/helm/button';
import { HlmDialogImports } from '@ctfdeck/helm/dialog';
import { HlmIconImports } from '@ctfdeck/helm/icon';
import { HlmInputImports } from '@ctfdeck/helm/input';
import { HlmLabelImports } from '@ctfdeck/helm/label';
import { HlmSelectImports } from '@ctfdeck/helm/select/src';

import { TargetCommandStoreService } from '../../targets/infrastructure/target-command-store.service';
import { WebSocketService } from '../../../infrastructure/transport/websocket/websocket.service';
import { SessionStore } from '../../sessions/state/session.store';
import { ScriptStore } from '../../scripts/state/script.store';
import { ToolCatalogStore } from '../../tools/state/tool-catalog.store';
import { RunnerJobStore } from '../../scripts/state/runner-job.store';
import { RunnerJobsModalComponent } from './runner-jobs-modal.component';
import type { SessionTarget } from '../../sessions/models/session-target.model';
import { ScriptCategory } from '../../scripts/models/script-category.enum';
import { scriptCategoryName } from '../../scripts/models/script-category-name';
import type { ToolCatalogItem } from '../../tools/models/tool-catalog-item.model';
import type { CommandOption } from '../models/command-option.model';
import type { CustomScript } from '../models/custom-script.model';
import type { ScriptForm } from '../models/script-form.model';
import {
  applyPendingSelection,
  buildCommandFromTemplate,
  buildCommandOptions,
  findScriptTemplate,
  findToolTemplate,
  getSelectedCommandId,
  hasSelectedCommand,
} from '../utils/command-runner-template.utils';
import {
  ansiToSafeHtml,
  createAnsiConverter,
  errorMessageOf,
  toSafeHtml,
} from '../utils/command-runner-render.utils';
import { createRenderScheduler } from '../utils/command-runner-render-scheduler.utils';
import { TranslatePipe } from '../../../shell/menubar/translate.pipe';
import { I18nService } from '../../../shell/menubar/i18n.service';

@Component({
  selector: 'app-command-runner',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ...BrnSelectImports,
    ...HlmSelectImports,
    ...BrnDialogImports,
    ...HlmButtonImports,
    ...HlmInputImports,
    ...HlmIconImports,
    ...HlmLabelImports,
    ...HlmDialogImports,
    BrnDialogContent,
    BrnDialogTrigger,
    BrnSelect,
    TranslatePipe,
    RunnerJobsModalComponent,
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
      lucideActivity,
    }),
  ],
  templateUrl: './command-runner.component.html',
  styleUrl: './command-runner.component.css',
})
export class CommandRunnerComponent implements OnInit, OnDestroy, OnChanges {
  @Output() closeEvent = new EventEmitter<void>();
  @Input() initialToolId = '';

  @ViewChild('outputContainer') private outputContainer!: ElementRef;

  private readonly targetCommandStore = inject(TargetCommandStoreService);
  private readonly wsService = inject(WebSocketService);
  private readonly sessionStore = inject(SessionStore);
  private readonly scriptStore = inject(ScriptStore);
  private readonly toolCatalogStore = inject(ToolCatalogStore);
  private readonly runnerJobStore = inject(RunnerJobStore);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly i18n = inject(I18nService);

  targets: SessionTarget[] = [];
  selectedTargetId = '';
  selectedToolId = '';
  selectedScriptId = '';
  currentCommand = '';

  // Jobs modal
  showJobsModal = false;
  runningJobCount = 0;

  // Help dialog (unchanged)
  isHelpRunning = false;
  helpOutput: SafeHtml | null = null;
  private readonly ansiConverter = createAnsiConverter();

  tools: ToolCatalogItem[] = [];
  commandOptions: CommandOption[] = [];
  customScripts: CustomScript[] = [];
  customScriptsLoading = false;
  showManageScripts = false;
  editingScriptId: string | null = null;
  scriptForm: ScriptForm = {
    name: '',
    category: ScriptCategory.Misc,
    template: '',
  };

  private pendingInitialSelection: string | null = null;
  private readonly subscriptions = new Subscription();
  public isSessionEnsuring = false;

  readonly scriptCategoryOptions = [
    { value: ScriptCategory.Recon, label: scriptCategoryName(ScriptCategory.Recon) },
    { value: ScriptCategory.Web, label: scriptCategoryName(ScriptCategory.Web) },
    { value: ScriptCategory.Crypto, label: scriptCategoryName(ScriptCategory.Crypto) },
    { value: ScriptCategory.Pwn, label: scriptCategoryName(ScriptCategory.Pwn) },
    { value: ScriptCategory.Forensics, label: scriptCategoryName(ScriptCategory.Forensics) },
    { value: ScriptCategory.Reverse, label: scriptCategoryName(ScriptCategory.Reverse) },
    { value: ScriptCategory.Misc, label: scriptCategoryName(ScriptCategory.Misc) },
  ];

  ngOnInit(): void {
    this.subscriptions.add(
      this.sessionStore.activeSession$.subscribe((session) => {
        this.targets = session?.targets || [];

        if (
          this.selectedTargetId &&
          !this.targets.find((target) => target.id === this.selectedTargetId)
        ) {
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
      this.scriptStore.scripts$.subscribe((scripts) => {
        this.customScripts = scripts;
        this.rebuildCommandOptions();
        this.applyPendingSelection();
        this.updateCommandPreview();
        this.cdr.detectChanges();
      }),
    );

    this.subscriptions.add(
      this.scriptStore.isLoading$.subscribe((loading) => {
        this.customScriptsLoading = loading;
      }),
    );

    this.subscriptions.add(
      this.runnerJobStore.runningCount$.subscribe((count) => {
        this.runningJobCount = count;
        this.cdr.detectChanges();
      }),
    );

    this.rebuildCommandOptions();
    void this.scriptStore.list();

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
    const savedCommand = this.targetCommandStore.getSavedCommand(target.id, selectedId);

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
      this.targetCommandStore.saveCommand(this.selectedTargetId, selectedId, this.currentCommand);
    }
  }

  async runCommand(): Promise<void> {
    if (!this.currentCommand) {
      return;
    }

    this.isSessionEnsuring = true;
    this.cdr.detectChanges();

    if (!(await this.ensureActiveSession())) {
      this.isSessionEnsuring = false;
      this.cdr.detectChanges();
      return;
    }

    this.isSessionEnsuring = false;
    this.cdr.detectChanges();

    const label =
      this.selectedToolId ||
      this.customScripts.find((s) => s.id === this.selectedScriptId)?.name ||
      this.currentCommand;

    this.runnerJobStore.run(this.currentCommand, label);
    this.showJobsModal = true;
  }

  openJobsModal(): void {
    this.showJobsModal = true;
  }

  runHelp(): void {
    if (!this.selectedToolId) {
      return;
    }

    this.isHelpRunning = true;
    this.helpOutput = null;

    let outputBuffer = '';
    let errorBuffer = '';

    const renderScheduler = createRenderScheduler(() => {
      this.renderHelpOutput(outputBuffer);
    });

    this.wsService
      .executeCommandStreaming(
        `${this.selectedToolId} -h`,
        (data: string) => {
          outputBuffer += data;
          renderScheduler.schedule();
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
        await this.scriptStore.update(
          this.editingScriptId,
          name,
          this.scriptForm.category,
          template,
        );
        toast.success('Script updated');
      } else {
        await this.scriptStore.create(name, this.scriptForm.category, template);
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
      await this.scriptStore.delete(scriptId);
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
    return (
      this.scriptCategoryOptions.find((option) => option.value === category)?.label || 'Unknown'
    );
  }

  resetScriptForm(): void {
    this.editingScriptId = null;
    this.scriptForm = {
      name: '',
      category: ScriptCategory.Misc,
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
    try {
      await this.sessionStore.ensureActiveSession();
      return true;
    } catch (error: unknown) {
      toast.error('Session error', { description: errorMessageOf(error) });
      return false;
    }
  }

  private renderHelpOutput(buffer: string): void {
    this.helpOutput = ansiToSafeHtml(this.ansiConverter, this.sanitizer, buffer);
    this.cdr.detectChanges();
  }
}