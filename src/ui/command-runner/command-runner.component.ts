import {
  Component,
  EventEmitter,
  Output,
  inject,
  ChangeDetectorRef,
  ViewChild,
  ElementRef,
  OnInit,
  OnDestroy,
  Input,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TargetService } from '../../app/core/services/target.service';
import { WebSocketService } from '../../app/infrastructure/transport/websocket/websocket.service';
import { SessionStoreService } from '../../app/core/services/session-store.service';
import { ScriptService } from '../../app/core/services/script.service';
import { ToolCatalogService } from '../../app/core/services/tool-catalog.service';
import {
  ScriptCategory,
  scriptCategoryName,
  SessionTarget,
} from '../../app/core/services/session.protocol';
import { ToolCatalogItem } from '../../app/domains/tools/models/tool-catalog-item.model';
import AnsiToHtml from 'ansi-to-html';
import { Subscription } from 'rxjs';
import { provideIcons } from '@ng-icons/core';
import {
  lucideTerminal,
  lucideX,
  lucideSave,
  lucidePlay,
  lucideSquare,
  lucideLoader,
  lucideCircleHelp,
  lucidePlus,
} from '@ng-icons/lucide';
import { BrnSelectImports } from '@spartan-ng/brain/select';
import { BrnDialogImports } from '@spartan-ng/brain/dialog';
import { HlmButtonImports } from '@ctfdeck/helm/button';
import { HlmInputImports } from '@ctfdeck/helm/input';
import { HlmIconImports } from '@ctfdeck/helm/icon';
import { HlmLabelImports } from '@ctfdeck/helm/label';
import { HlmDialogImports } from '@ctfdeck/helm/dialog';
import { toast } from 'ngx-sonner';

type CommandOption = { id: string; name: string; kind: 'tool' | 'script' };

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
export class CommandRunnerComponent implements OnInit, OnDestroy {
  @Output() closeEvent = new EventEmitter<void>();

  private targetService = inject(TargetService);
  private wsService = inject(WebSocketService);
  private sessionStore = inject(SessionStoreService);
  private scriptService = inject(ScriptService);
  private toolCatalogService = inject(ToolCatalogService);
  private cdr = inject(ChangeDetectorRef);
  private sanitizer = inject(DomSanitizer);

  @ViewChild('outputContainer') private outputContainer!: ElementRef;

  targets: SessionTarget[] = [];
  selectedTargetId: string = '';
  selectedToolId: string = '';
  selectedScriptId: string = '';
  currentCommand: string = '';
  isRunning = false;
  isSessionEnsuring = false;

  outputLines: SafeHtml[] = [];
  private subscriptions: Subscription = new Subscription();

  isHelpRunning = false;
  helpOutput: SafeHtml | null = null;

  @Input() initialToolId: string = '';

  tools: ToolCatalogItem[] = [];
  commandOptions: CommandOption[] = [];
  customScripts: Array<{ id: string; name: string; category: number; template: string }> = [];
  customScriptsLoading = false;
  showManageScripts = false;
  editingScriptId: string | null = null;
  scriptForm = { name: '', category: ScriptCategory.Other, template: '' };
  private pendingInitialSelection: string | null = null;

  readonly scriptCategoryOptions = [
    { value: ScriptCategory.Discovery, label: scriptCategoryName(ScriptCategory.Discovery) },
    { value: ScriptCategory.Web, label: scriptCategoryName(ScriptCategory.Web) },
    { value: ScriptCategory.ReverseShell, label: scriptCategoryName(ScriptCategory.ReverseShell) },
    { value: ScriptCategory.Exploit, label: scriptCategoryName(ScriptCategory.Exploit) },
    { value: ScriptCategory.Other, label: scriptCategoryName(ScriptCategory.Other) },
  ];

  private ansiConverter = new AnsiToHtml({
    fg: '#d4d4d4',
    bg: '#1e1e1e',
    newline: true,
    colors: {
      4: '#61afef',
      34: '#61afef',
    },
  });

  ngOnInit() {
    this.subscriptions.add(
      this.sessionStore.activeSession$.subscribe((session) => {
        this.targets = session?.targets || [];
        if (this.selectedTargetId && !this.targets.find((t) => t.id === this.selectedTargetId)) {
          this.selectedTargetId = '';
        }
        this.updateCommandOptions();
        this.updateCommandPreview();
      }),
    );

    this.subscriptions.add(
      this.toolCatalogService.tools$.subscribe((tools) => {
        this.tools = tools.filter((tool) => tool.kind === 'binary');
        this.updateCommandOptions();
        this.applyPendingSelection();
        this.updateCommandPreview();
        this.cdr.detectChanges();
      }),
    );

    this.subscriptions.add(
      this.scriptService.scripts$.subscribe((scripts) => {
        this.customScripts = scripts;
        this.updateCommandOptions();
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

    this.updateCommandOptions();
    void this.scriptService.list();

    if (this.initialToolId) {
      this.pendingInitialSelection = this.initialToolId;
      this.applyPendingSelection();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['initialToolId'] && changes['initialToolId'].currentValue) {
      const value = changes['initialToolId'].currentValue;
      if (value === '__manage_scripts__') {
        this.showManageScripts = true;
        return;
      }
      this.pendingInitialSelection = value;
      this.applyPendingSelection();
    }
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  close() {
    this.closeEvent.emit();
  }

  onTargetChange() {
    this.updateCommandPreview();
  }

  private updateCommandOptions() {
    const toolOptions: CommandOption[] = this.tools.map((tool) => ({
      id: tool.id,
      name: tool.displayName,
      kind: 'tool',
    }));

    const scriptOptions: CommandOption[] = this.customScripts.map((script) => ({
      id: script.id,
      name: script.name,
      kind: 'script',
    }));

    this.commandOptions = [...toolOptions, ...scriptOptions];
  }

  selectCommandOption(option: CommandOption) {
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

  selectTool(toolId: string) {
    this.selectedToolId = toolId;
    this.selectedScriptId = '';
    this.updateCommandPreview();
  }

  selectScript(scriptId: string) {
    this.selectedScriptId = scriptId;
    this.selectedToolId = '';
    this.updateCommandPreview();
  }

  updateCommandPreview() {
    if (!this.selectedTargetId || (!this.selectedToolId && !this.selectedScriptId)) {
      this.currentCommand = '';
      return;
    }

    const target = this.targets.find((t) => t.id === this.selectedTargetId);
    if (!target) {
      this.currentCommand = '';
      return;
    }

    const selectedId = this.selectedToolId || this.selectedScriptId;
    const savedCommand = this.targetService.getSavedCommand(target.id, selectedId);
    if (savedCommand) {
      this.currentCommand = savedCommand;
      return;
    }

    const template = this.selectedToolId
      ? this.toolCatalogService.getCommandTemplate(this.selectedToolId)
      : (this.customScripts.find((s) => s.id === this.selectedScriptId)?.template ?? null);

    if (!template) {
      this.currentCommand = '';
      return;
    }

    let cmd = template;
    cmd = cmd.replace(/{host}/g, target.address);
    const port = target.port ?? (cmd.includes('http') ? 80 : '');
    cmd = cmd.replace(/{port}/g, port.toString());
    this.currentCommand = cmd;
  }

  saveCommand() {
    const selectedId = this.selectedToolId || this.selectedScriptId;
    if (this.selectedTargetId && selectedId && this.currentCommand) {
      this.targetService.saveTargetCommand(this.selectedTargetId, selectedId, this.currentCommand);
    }
  }

  async runCommand() {
    if (!this.currentCommand) return;

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
    const MIN_RENDER_INTERVAL = 16;

    const scheduleRender = () => {
      if (pendingRender) return;
      const now = performance.now();
      if (now - lastRenderTime < MIN_RENDER_INTERVAL) {
        pendingRender = true;
        requestAnimationFrame(() => {
          pendingRender = false;
          lastRenderTime = performance.now();
          this.renderOutputBuffer(outputLineIndex, outputBuffer);
        });
      } else {
        lastRenderTime = now;
        this.renderOutputBuffer(outputLineIndex, outputBuffer);
      }
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
            this.outputLines.push(this.createSafeHtml(''));
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
      .catch((err: any) => {
        this.isRunning = false;
        this.addLine(`<span class="text-red-500">Error: ${err.message}</span>`);
        this.cdr.detectChanges();
      });
  }

  private async ensureActiveSession(): Promise<boolean> {
    this.isSessionEnsuring = true;
    try {
      await this.sessionStore.ensureActiveSession();
      return true;
    } catch (err: any) {
      this.addLine(`<span class="text-red-500">Session error: ${err?.message || err}</span>`);
      return false;
    } finally {
      this.isSessionEnsuring = false;
      this.cdr.detectChanges();
    }
  }

  stopCommand() {
    this.isRunning = false;
    this.addLine(`<span class="text-yellow-500">Stop requested (UI only)</span>`);
  }

  clearOutput() {
    this.outputLines = [];
  }

  runHelp() {
    if (!this.selectedToolId) return;

    this.isHelpRunning = true;
    this.helpOutput = null;

    let outputBuffer = '';
    let errorBuffer = '';
    let pendingRender = false;
    let lastRenderTime = 0;
    const MIN_RENDER_INTERVAL = 16;

    const scheduleRender = () => {
      if (pendingRender) return;
      const now = performance.now();
      if (now - lastRenderTime < MIN_RENDER_INTERVAL) {
        pendingRender = true;
        requestAnimationFrame(() => {
          pendingRender = false;
          lastRenderTime = performance.now();
          this.renderHelpOutput(outputBuffer);
        });
      } else {
        lastRenderTime = now;
        this.renderHelpOutput(outputBuffer);
      }
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
      .then((result) => {
        this.isHelpRunning = false;
        this.renderHelpOutput(outputBuffer);
        this.cdr.detectChanges();
      })
      .catch((err: any) => {
        this.isHelpRunning = false;
        this.helpOutput = this.sanitizer.bypassSecurityTrustHtml(
          `<span class="text-red-500">Error running help: ${err.message}</span>`,
        );
        this.cdr.detectChanges();
      });
  }

  get canShowHelp(): boolean {
    return !!this.selectedToolId;
  }

  openManageScripts() {
    this.showManageScripts = true;
    this.resetScriptForm();
  }

  closeManageScripts() {
    this.showManageScripts = false;
    this.resetScriptForm();
  }

  editScript(script: { id: string; name: string; category: number; template: string }) {
    this.editingScriptId = script.id;
    this.scriptForm = {
      name: script.name,
      category: script.category as ScriptCategory,
      template: script.template,
    };
    this.showManageScripts = true;
  }

  async saveScript() {
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
        await this.scriptService.create(name, this.scriptForm.category, template);
        toast.success('Script created');
      }
      this.resetScriptForm();
    } catch (err: any) {
      toast.error('Script operation failed', { description: err?.message || 'Unknown error' });
    }
  }

  async deleteScript(scriptId: string) {
    try {
      await this.scriptService.delete(scriptId);
      toast.success('Script deleted');
      if (this.selectedScriptId === scriptId) {
        this.selectedScriptId = '';
        this.currentCommand = '';
      }
    } catch (err: any) {
      toast.error('Delete failed', { description: err?.message || 'Unknown error' });
    }
  }

  getScriptCategoryLabel(category: number): string {
    return (
      this.scriptCategoryOptions.find((option) => option.value === category)?.label || 'Unknown'
    );
  }

  resetScriptForm() {
    this.editingScriptId = null;
    this.scriptForm = { name: '', category: ScriptCategory.Other, template: '' };
  }

  private applyPendingSelection() {
    if (!this.pendingInitialSelection) return;
    const value = this.pendingInitialSelection;

    if (value === '__manage_scripts__') {
      this.showManageScripts = true;
      this.pendingInitialSelection = null;
      return;
    }

    if (this.tools.find((t) => t.id === value)) {
      this.selectTool(value);
      this.pendingInitialSelection = null;
      return;
    }

    const script = this.customScripts.find((s) => s.id === value);
    if (script) {
      this.selectScript(script.id);
      this.pendingInitialSelection = null;
    }
  }

  private renderOutputBuffer(lineIndex: number, buffer: string): void {
    if (lineIndex < 0 || lineIndex >= this.outputLines.length) return;
    const html = this.ansiConverter.toHtml(buffer);
    this.outputLines[lineIndex] = this.sanitizer.bypassSecurityTrustHtml(html);
    this.cdr.detectChanges();
    this.scrollToBottom();
  }

  private renderHelpOutput(buffer: string): void {
    const html = this.ansiConverter.toHtml(buffer);
    this.helpOutput = this.sanitizer.bypassSecurityTrustHtml(html);
    this.cdr.detectChanges();
  }

  private appendToLastError(data: string) {
    if (this.outputLines.length > 0) {
      const lastLine = this.outputLines[this.outputLines.length - 1];
      const currentContent = this.sanitizer.sanitize(0, lastLine) || '';
      const newContent = currentContent + data;
      this.outputLines[this.outputLines.length - 1] = this.sanitizer.bypassSecurityTrustHtml(
        `<span class="text-red-500">${newContent}</span>`,
      );
      this.cdr.detectChanges();
    } else {
      this.addLine(`<span class="text-red-500">${data}</span>`);
    }
  }

  private createSafeHtml(content: string) {
    return this.sanitizer.bypassSecurityTrustHtml(content);
  }

  private addLine(htmlContent: string) {
    const safeHtml = this.sanitizer.bypassSecurityTrustHtml(htmlContent);
    this.outputLines.push(safeHtml);
    this.cdr.detectChanges();
    this.scrollToBottom();
  }

  private scrollToBottom() {
    setTimeout(() => {
      if (this.outputContainer) {
        this.outputContainer.nativeElement.scrollTop =
          this.outputContainer.nativeElement.scrollHeight;
      }
    }, 0);
  }
}
