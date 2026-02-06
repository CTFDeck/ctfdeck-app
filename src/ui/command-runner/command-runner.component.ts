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
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TargetService } from '../../app/core/services/target.service';
import { WebSocketService } from '../../app/core/services/websocket.service';
import { SessionStoreService } from '../../app/core/services/session-store.service';
import { ScriptService } from '../../app/core/services/script.service';
import { ScriptCategory, scriptCategoryName, SessionTarget } from '../../app/core/services/session.protocol';
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
} from '@ng-icons/lucide';
import { TOOLS } from '../../app/core/constants/tools';
import { Input, SimpleChanges } from '@angular/core';
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
    }),
  ],
  template: `
    <div class="h-full flex flex-col bg-background text-foreground p-6">
      <!-- Header -->
      <div class="flex justify-between items-center mb-6 border-b border-border pb-4">
        <div class="flex items-center gap-2">
          <ng-icon hlm name="lucideTerminal" class="text-primary text-2xl" />
          <h2 class="text-2xl font-bold tracking-tight">Command Runner</h2>
        </div>
      </div>

      <!-- Settings Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
        <!-- Left: Target & Tool -->
        <div class="space-y-6">
          <!-- Target Section -->
          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <label hlmLabel>Target</label>
            </div>

            <ng-container *ngIf="targets.length > 0; else noTargets">
              <select
                [(ngModel)]="selectedTargetId"
                (ngModelChange)="onTargetChange()"
                class="flex w-full h-10 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="" disabled selected>Select a target...</option>
                <option *ngFor="let target of targets" [value]="target.id">
                  {{ target.name }} ({{ target.address }})
                </option>
              </select>
            </ng-container>

            <ng-template #noTargets>
              <div
                class="flex items-center justify-center p-3 border border-dashed border-border rounded-md bg-muted/50 text-muted-foreground text-sm"
              >
                No targets available
              </div>
            </ng-template>
          </div>

          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <label hlmLabel>Commands</label>
              <button hlmBtn size="icon" variant="outline" (click)="openManageScripts()" title="Manage custom scripts">
                +
              </button>
            </div>
            <div class="flex flex-wrap gap-2">
              <div *ngIf="customScriptsLoading && customScripts.length === 0" class="flex gap-2">
                <div class="h-8 w-28 rounded-md bg-muted/70 animate-pulse"></div>
                <div class="h-8 w-24 rounded-md bg-muted/70 animate-pulse"></div>
              </div>
              <button
                *ngFor="let item of commandOptions"
                hlmBtn
                [variant]="isCommandSelected(item) ? 'default' : 'outline'"
                size="sm"
                (click)="selectCommandOption(item)"
              >
                {{ item.name }}
              </button>
            </div>
          </div>
        </div>

        <!-- Right: Command & Controls -->
        <div class="space-y-6">
          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <label hlmLabel>Command</label>
            </div>
            <div class="flex gap-2">
              <input
                hlmInput
                class="flex-1 font-mono"
                [(ngModel)]="currentCommand"
                placeholder="Select target and command..."
              />

              <button
                hlmBtn
                variant="outline"
                size="icon"
                (click)="saveCommand()"
                title="Save as default"
              >
                <ng-icon hlm name="lucideSave" size="sm" />
              </button>

              <!-- Help Dialog Trigger -->
              <hlm-dialog>
                <button
                  brnDialogTrigger
                  hlmBtn
                  variant="outline"
                  size="icon"
                  (click)="runHelp()"
                  [disabled]="!canShowHelp"
                  title="Show Help"
                >
                  <ng-icon hlm name="lucideCircleHelp" />
                </button>
                <hlm-dialog-content
                  *brnDialogContent="let ctx"
                  class="border border-border bg-background text-foreground shadow-lg rounded-md p-0 max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col"
                >
                  <hlm-dialog-header class="p-6 border-b border-border">
                    <h3 hlmDialogTitle>Help: {{ selectedToolId }}</h3>
                    <p hlmDialogDescription class="mt-2 text-sm text-muted-foreground">
                      Output of
                      <code class="px-1.5 py-0.5 rounded bg-muted text-xs font-mono"
                        >{{ selectedToolId }} -h</code
                      >
                    </p>
                  </hlm-dialog-header>

                  <div
                    class="p-6 flex-1 overflow-auto bg-muted rounded-md m-6 border border-border font-mono text-sm"
                  >
                    <div
                      *ngIf="isHelpRunning"
                      class="flex items-center gap-2 text-muted-foreground p-4"
                    >
                      <ng-icon hlm name="lucideLoader" class="animate-spin" /> Loading help...
                    </div>
                    <div
                      *ngIf="!isHelpRunning"
                      class="whitespace-pre-wrap text-foreground p-2 leading-relaxed"
                      [innerHTML]="helpOutput"
                    ></div>
                  </div>

                  <hlm-dialog-footer class="p-6 border-t border-border flex justify-end">
                    <button hlmBtn variant="outline" (click)="ctx.close()">Close</button>
                  </hlm-dialog-footer>
                </hlm-dialog-content>
              </hlm-dialog>
            </div>
          </div>

          <div class="flex justify-end gap-3 pt-2">
            <button
              *ngIf="isRunning"
              hlmBtn
              variant="destructive"
              (click)="stopCommand()"
              class="gap-2"
            >
              <ng-icon hlm name="lucideSquare" class="h-4 w-4" /> Stop
            </button>
            <button
              hlmBtn
              [disabled]="isRunning || !currentCommand || isSessionEnsuring"
              (click)="runCommand()"
              class="gap-2 min-w-[120px]"
            >
              <ng-icon
                hlm
                [name]="isRunning ? 'lucideLoader' : 'lucidePlay'"
                [class]="isRunning ? 'animate-spin h-4 w-4' : 'h-4 w-4'"
              />
              {{ isRunning ? 'Running...' : 'Run' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Output Terminal -->
      <div
        class="flex-1 flex flex-col min-h-0 rounded-md border border-border bg-card text-card-foreground overflow-hidden font-mono"
      >
        <div
          class="flex justify-between items-center px-3 py-2 bg-muted/30 border-b border-border"
        >
          <span class="text-xs font-medium text-muted-foreground">Terminal Output</span>
          <button
            class="text-xs text-muted-foreground hover:text-foreground transition-colors"
            (click)="clearOutput()"
          >
            Clear
          </button>
        </div>
        <div
          #outputContainer
          class="flex-1 overflow-auto p-3 text-sm leading-relaxed whitespace-pre-wrap"
        >
          <div *ngFor="let line of outputLines" [innerHTML]="line" class="mb-0.5 break-all"></div>
          <div *ngIf="outputLines.length === 0" class="text-muted-foreground italic">
            Ready to execute...
          </div>
        </div>
      </div>
    </div>

    <div
      *ngIf="showManageScripts"
      class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      (click)="closeManageScripts()"
    >
      <div
        class="bg-background border border-border rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
        (click)="$event.stopPropagation()"
      >
        <div class="p-6 border-b border-border flex items-center justify-between">
          <h3 class="text-lg font-semibold">Manage Custom Scripts</h3>
          <button hlmBtn size="sm" variant="ghost" (click)="closeManageScripts()">Close</button>
        </div>
        <div class="p-6 space-y-4 max-h-[70vh] overflow-auto">
          <div class="space-y-3">
            <div class="grid gap-2">
              <label hlmLabel>Name</label>
              <input hlmInput [(ngModel)]="scriptForm.name" placeholder="Script name" />
            </div>
            <div class="grid gap-2">
              <label hlmLabel>Category</label>
              <select
                [(ngModel)]="scriptForm.category"
                class="flex w-full h-10 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option *ngFor="let option of scriptCategoryOptions" [ngValue]="option.value">
                  {{ option.label }}
                </option>
              </select>
            </div>
            <div class="grid gap-2">
              <label hlmLabel>Template</label>
              <textarea
                rows="4"
                [(ngModel)]="scriptForm.template"
                class="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                placeholder="Command template, use {host} and {port}"
              ></textarea>
            </div>
            <div class="flex justify-end gap-2">
              <button hlmBtn variant="outline" (click)="resetScriptForm()">Reset</button>
              <button hlmBtn (click)="saveScript()">
                {{ editingScriptId ? 'Update Script' : 'Create Script' }}
              </button>
            </div>
          </div>

          <div class="border-t border-border pt-4">
            <h4 class="text-sm font-semibold mb-3">Existing Scripts</h4>
            <div *ngIf="customScriptsLoading && customScripts.length === 0" class="space-y-2">
              <div class="h-10 rounded-md bg-muted/70 animate-pulse"></div>
              <div class="h-10 rounded-md bg-muted/70 animate-pulse"></div>
            </div>
            <div *ngIf="!customScriptsLoading && customScripts.length === 0" class="text-sm text-muted-foreground">
              No custom scripts yet.
            </div>
            <div class="space-y-2">
              <div
                *ngFor="let script of customScripts"
                class="flex items-center justify-between rounded-md border border-border p-3"
              >
                <div>
                  <div class="font-medium">{{ script.name }}</div>
                  <div class="text-xs text-muted-foreground">
                    {{ getScriptCategoryLabel(script.category) }}
                  </div>
                </div>
                <div class="flex gap-2">
                  <button hlmBtn size="sm" variant="outline" (click)="editScript(script)">
                    Edit
                  </button>
                  <button hlmBtn size="sm" variant="destructive" (click)="deleteScript(script.id)">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
      }

      .ft-dir {
        color: #60a5fa;
      } /* blue */
      .ft-arc {
        color: #fbbf24;
      } /* yellow */
      .ft-bin {
        color: #f87171;
      } /* red */
      .ft-lnk {
        color: #a78bfa;
      } /* purple */
      .ft-txt {
        color: #d1d5db;
      } /* light grey */
      .ft-img {
        color: #34d399;
      } /* green */
      .ft-vid {
        color: #fb7185;
      } /* pink */
      .ft-aud {
        color: #22c55e;
      } /* green */
      .ft-unk {
        color: #9ca3af;
      } /* grey */

      /* Hide the auto-generated close button in the dialog header */
      ::ng-deep [data-slot="dialog-close"] {
        display: none !important;
      }
    `,
  ],
})
export class CommandRunnerComponent implements OnInit, OnDestroy {
  @Output() closeEvent = new EventEmitter<void>();

  private targetService = inject(TargetService);
  private wsService = inject(WebSocketService);
  private sessionStore = inject(SessionStoreService);
  private scriptService = inject(ScriptService);
  private cdr = inject(ChangeDetectorRef);
  private sanitizer = inject(DomSanitizer);

  @ViewChild('outputContainer') private outputContainer!: ElementRef;

  targets: SessionTarget[] = [];
  selectedTargetId: string = '';
  selectedToolId: string = '';
  selectedScriptId: string = '';
  currentCommand: string = '';
  isRunning: boolean = false;
  isSessionEnsuring: boolean = false;

  outputLines: SafeHtml[] = [];
  private subscriptions: Subscription = new Subscription();

  // Help State
  isHelpRunning = false;
  helpOutput: SafeHtml | null = null;

  @Input() initialToolId: string = '';

  // Tools definition
  readonly tools = TOOLS;
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
    console.log('CommandRunnerComponent initialized with initialToolId:', this.initialToolId);
    this.subscriptions.add(
      this.sessionStore.activeSession$.subscribe((session) => {
        this.targets = session?.targets || [];
        if (this.selectedTargetId && !this.targets.find((t) => t.id === this.selectedTargetId)) {
          this.selectedTargetId = '';
        }
        this.updateCommandPreview();
      }),
    );

    this.subscriptions.add(
      this.scriptService.scripts$.subscribe((scripts) => {
        this.customScripts = scripts;
        this.applyPendingSelection();
      }),
    );

    this.subscriptions.add(
      this.scriptService.isLoading$.subscribe((loading) => {
        this.customScriptsLoading = loading;
      }),
    );
    void this.scriptService.list();

    if (this.initialToolId) {
      this.pendingInitialSelection = this.initialToolId;
      this.applyPendingSelection();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    console.log('CommandRunnerComponent ngOnChanges:', changes);
    if (changes['initialToolId'] && changes['initialToolId'].currentValue) {
      console.log('Selecting tool from ngOnChanges:', changes['initialToolId'].currentValue);
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

  get commandOptions(): CommandOption[] {
    const toolOptions: CommandOption[] = this.tools.map((tool) => ({
      id: tool.id,
      name: tool.name,
      kind: 'tool',
    }));
    const scriptOptions: CommandOption[] = this.customScripts.map((script) => ({
      id: script.id,
      name: script.name,
      kind: 'script',
    }));
    return [...toolOptions, ...scriptOptions];
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
    if (!this.selectedTargetId || (!this.selectedToolId && !this.selectedScriptId)) return;

    const target = this.targets.find((t) => t.id === this.selectedTargetId);
    if (!target) return;

    // Check if we have a saved command for this target+tool
    const selectedId = this.selectedToolId || this.selectedScriptId;
    const savedCommand = this.targetService.getSavedCommand(target.id, selectedId);
    if (savedCommand) {
      this.currentCommand = savedCommand;
      return;
    }

    const template =
      this.selectedToolId
        ? this.tools.find((t) => t.id === this.selectedToolId)?.template
        : this.customScripts.find((s) => s.id === this.selectedScriptId)?.template;

    if (template) {
      let cmd = template;
      cmd = cmd.replace(/{host}/g, target.address);
      const port = target.port ?? (cmd.includes('http') ? 80 : '');
      cmd = cmd.replace(/{port}/g, port.toString());
      this.currentCommand = cmd;
    }
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

    // High-performance streaming - similar to terminal component
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

    this.wsService
      .executeCommandStreaming(
        this.currentCommand,
        (data: string) => {
          outputBuffer += data;
          if (outputLineIndex === -1) {
            outputLineIndex = this.outputLines.length;
            this.outputLines.push(this.createSafeHtml('')); // Initialize with empty content
          }
          scheduleRender();
        },
        (data: string) => {
          errorBuffer += data;
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

  // Help Logic
  runHelp() {
    console.log('Running help for tool:', this.selectedToolId);
    if (!this.selectedToolId) return;

    this.isHelpRunning = true;
    this.helpOutput = null; // Clear previous help

    // High-performance streaming for help - similar to terminal component
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
          console.log('Help output received:', data);
          outputBuffer += data;
          scheduleRender();
        },
        (error: string) => {
          console.error('Help error received:', error);
          errorBuffer += error;
        },
      )
      .then((result) => {
        console.log('Help command completed with result:', result);
        this.isHelpRunning = false;
        // Render final output
        this.renderHelpOutput(outputBuffer);
        this.cdr.detectChanges();
      })
      .catch((err: any) => {
        console.error('Help command failed:', err);
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
    return this.scriptCategoryOptions.find((option) => option.value === category)?.label || 'Unknown';
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

  private appendOutput(data: string, isError: boolean = false) {
    const html = this.ansiConverter.toHtml(data);
    this.addLine(html);
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

  consoleLog(message: string) {
    console.log(message);
  }
}
