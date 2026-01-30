import { Component, EventEmitter, Output, inject, ChangeDetectorRef, ViewChild, ElementRef, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TargetService, Target } from '../../app/core/services/target.service';
import { WebSocketService } from '../../app/core/services/websocket.service';
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
  lucideCircleHelp 
} from '@ng-icons/lucide';
import { TOOLS } from '../../app/core/constants/tools';
import { Input, OnChanges, SimpleChanges } from '@angular/core';

import { BrnSelectImports } from '@spartan-ng/brain/select';
import { BrnDialogImports } from '@spartan-ng/brain/dialog';
import { HlmSelectImports } from '@ctfdeck/helm/select';
import { HlmButtonImports } from '@ctfdeck/helm/button';
import { HlmInputImports } from '@ctfdeck/helm/input';
import { HlmIconImports } from '@ctfdeck/helm/icon';
import { HlmLabelImports } from '@ctfdeck/helm/label';
import { HlmDialogImports } from '@ctfdeck/helm/dialog';

@Component({
  selector: 'app-command-runner',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    ...BrnSelectImports,
    ...BrnDialogImports,
    ...HlmSelectImports,
    ...HlmButtonImports,
    ...HlmInputImports,
    ...HlmIconImports,
    ...HlmLabelImports,
    ...HlmDialogImports
  ],
  providers: [
    provideIcons({ 
      lucideTerminal, 
      lucideX, 
      lucideSave, 
      lucidePlay, 
      lucideSquare, 
      lucideLoader, 
      lucideCircleHelp 
    })
  ],
  template: `
    <div class="h-full flex flex-col bg-background text-foreground p-6">
      <!-- Header -->
      <div class="flex justify-between items-center mb-6 border-b border-border pb-4">
        <div class="flex items-center gap-2">
            <ng-icon hlm name="lucideTerminal" class="text-primary text-2xl" />
            <h2 class="text-2xl font-bold tracking-tight">Command Runner</h2>
        </div>
        <button hlmBtn variant="ghost" size="icon" (click)="close()">
          <ng-icon hlm name="lucideX" />
        </button>
      </div>

      <!-- Settings Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
        
        <!-- Left: Target & Tool -->
        <div class="space-y-6">
            <div class="space-y-2">
                <label hlmLabel>Target</label>
                <brn-select hlm class="w-full" [(ngModel)]="selectedTargetId" (ngModelChange)="onTargetChange()" placeholder="Select a target...">
                    <hlm-select-trigger class="w-full">
                        <hlm-select-value />
                    </hlm-select-trigger>
                    <hlm-select-content class="max-h-60">
                        <hlm-option *ngFor="let target of targets" [value]="target.id">
                            {{ target.name }} ({{ target.host }})
                        </hlm-option>
                    </hlm-select-content>
                </brn-select>
            </div>

            <div class="space-y-2">
                <label hlmLabel>Tool</label>
                <div class="flex flex-wrap gap-2">
                    <button *ngFor="let tool of tools"
                            hlmBtn
                            [variant]="selectedToolId === tool.id ? 'default' : 'outline'"
                            size="sm"
                            (click)="selectTool(tool.id)">
                        {{ tool.name }}
                    </button>
                </div>
            </div>
        </div>

        <!-- Right: Command & Controls -->
        <div class="space-y-6">
            <div class="space-y-2">
                 <div class="flex justify-between items-center">
                    <label hlmLabel>Command</label>
                    <button hlmBtn variant="ghost" size="icon" class="h-6 w-6" (click)="saveCommand()" title="Save as default">
                        <ng-icon hlm name="lucideSave" size="sm" />
                    </button>
                 </div>
                 <div class="flex gap-2">
                    <input hlmInput class="flex-1 font-mono" [(ngModel)]="currentCommand" placeholder="Select target & tool..." />
                    
                    <!-- Help Dialog Trigger -->
                    <hlm-dialog>
                        <button brnDialogTrigger hlmBtn variant="outline" size="icon" (click)="runHelp()" [disabled]="!selectedToolId" title="Show Help">
                            <ng-icon hlm name="lucideCircleHelp" />
                        </button>
                        <hlm-dialog-content *brnDialogContent="let ctx" class="max-w-3xl max-h-[80vh] flex flex-col">
                            <hlm-dialog-header>
                                <h3 hlmDialogTitle>Help: {{selectedToolId}}</h3>
                                <p hlmDialogDescription>
                                    Output of <code>{{selectedToolId}} -h</code>
                                </p>
                            </hlm-dialog-header>
                            
                            <div class="flex-1 overflow-auto bg-slate-950 p-4 rounded-md mt-2 border border-slate-800">
                                <div *ngIf="isHelpRunning" class="flex items-center gap-2 text-muted-foreground">
                                    <ng-icon hlm name="lucideLoader" class="animate-spin" /> Loading help...
                                </div>
                                <div *ngIf="!isHelpRunning" class="font-mono text-xs whitespace-pre-wrap text-slate-300" [innerHTML]="helpOutput"></div>
                            </div>

                            <hlm-dialog-footer class="mt-4">
                                <button hlmBtn variant="outline" (click)="ctx.close()">Close</button>
                            </hlm-dialog-footer>
                        </hlm-dialog-content>
                    </hlm-dialog>
                 </div>
                 <p class="text-xs text-muted-foreground">
                    Customize the command and click <ng-icon hlm name="lucideSave" class="inline h-3 w-3" /> to save.
                 </p>
            </div>

            <div class="flex justify-end gap-3 pt-2">
                <button *ngIf="isRunning" hlmBtn variant="destructive" (click)="stopCommand()" class="gap-2">
                    <ng-icon hlm name="lucideSquare" class="h-4 w-4" /> Stop
                </button>
                <button hlmBtn [disabled]="isRunning || !currentCommand" (click)="runCommand()" class="gap-2 min-w-[120px]">
                    <ng-icon hlm [name]="isRunning ? 'lucideLoader' : 'lucidePlay'" [class]="isRunning ? 'animate-spin h-4 w-4' : 'h-4 w-4'" /> 
                    {{ isRunning ? 'Running...' : 'Run' }}
                </button>
            </div>
        </div>
      </div>


      <!-- Output Terminal -->
      <div class="flex-1 flex flex-col min-h-0 rounded-md border border-border bg-[#1e1e1e] overflow-hidden">
        <div class="flex justify-between items-center px-4 py-2 border-b border-white/10 bg-white/5">
            <span class="text-xs font-medium text-slate-400">Terminal Output</span>
            <button class="text-xs text-slate-400 hover:text-white transition-colors" (click)="clearOutput()">Clear</button>
        </div>
        <div #outputContainer class="flex-1 overflow-auto p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap text-[#d4d4d4]">
             <div *ngFor="let line of outputLines" [innerHTML]="line"></div>
             <div *ngIf="outputLines.length === 0" class="text-slate-600 italic">
                Ready to execute...
             </div>
        </div>
      </div>

    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }
  `]
})
export class CommandRunnerComponent implements OnInit, OnDestroy {
  @Output() closeEvent = new EventEmitter<void>();
  
  private targetService = inject(TargetService);
  private wsService = inject(WebSocketService);
  private cdr = inject(ChangeDetectorRef);
  private sanitizer = inject(DomSanitizer);

  @ViewChild('outputContainer') private outputContainer!: ElementRef;

  targets: Target[] = [];
  selectedTargetId: string = '';
  selectedToolId: string = '';
  currentCommand: string = '';
  isRunning: boolean = false;
  
  outputLines: SafeHtml[] = [];
  private subscriptions: Subscription = new Subscription();

  // Help State
  isHelpRunning = false;
  helpOutput: SafeHtml | null = null;
  
  @Input() initialToolId: string = '';

  // Tools definition
  readonly tools = TOOLS;

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
    this.targets = this.targetService.getTargets();
    if (this.initialToolId) {
        this.selectTool(this.initialToolId);
    }
  }
  
  ngOnChanges(changes: SimpleChanges) {
      if (changes['initialToolId'] && changes['initialToolId'].currentValue) {
          this.selectTool(changes['initialToolId'].currentValue);
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

  selectTool(toolId: string) {
    this.selectedToolId = toolId;
    this.updateCommandPreview();
  }

  updateCommandPreview() {
    if (!this.selectedTargetId || !this.selectedToolId) return;

    const target = this.targets.find(t => t.id === this.selectedTargetId);
    if (!target) return;

    // Check if we have a saved command for this target+tool
    if (target.commands && target.commands[this.selectedToolId]) {
      this.currentCommand = target.commands[this.selectedToolId];
    } else {
      // Generate from template
      const tool = this.tools.find(t => t.id === this.selectedToolId);
      if (tool) {
        let cmd = tool.template;
        cmd = cmd.replace(/{host}/g, target.host);
        cmd = cmd.replace(/{port}/g, (target.port || (cmd.includes('http') ? 80 : '')).toString());
        this.currentCommand = cmd;
      }
    }
  }

  saveCommand() {
    if (this.selectedTargetId && this.selectedToolId && this.currentCommand) {
      this.targetService.saveTargetCommand(this.selectedTargetId, this.selectedToolId, this.currentCommand);
      this.targets = this.targetService.getTargets();
    }
  }

  runCommand() {
    if (!this.currentCommand) return;
    
    this.isRunning = true;
    this.outputLines = [];
    this.addLine(`<span class="text-blue-400">Running: ${this.currentCommand}</span>`);

    this.wsService.executeCommandStreaming(
      this.currentCommand,
      (data) => {
        this.appendOutput(data);
      },
      (error) => {
        this.appendOutput(error, true);
      }
    ).then((result: any) => {
      this.isRunning = false;
      this.addLine(`<span class="text-green-400">Done. Exit code: ${result.exitCode}</span>`);
      this.cdr.detectChanges();
    }).catch((err: any) => {
        this.isRunning = false;
        this.addLine(`<span class="text-red-500">Error: ${err.message}</span>`);
        this.cdr.detectChanges();
    });
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
      if (!this.selectedToolId) return;
      
      this.isHelpRunning = true;
      this.helpOutput = null; // Clear previous help
      
      let outputAcc = '';
      this.wsService.executeCommandStreaming(
        `${this.selectedToolId} -h`,
        (data) => outputAcc += data, 
        (error) => outputAcc += error
      ).then(() => {
          this.isHelpRunning = false;
          const html = this.ansiConverter.toHtml(outputAcc);
          this.helpOutput = this.sanitizer.bypassSecurityTrustHtml(html);
          this.cdr.detectChanges();
      }).catch((err: any) => {
          this.isHelpRunning = false;
          this.helpOutput = this.sanitizer.bypassSecurityTrustHtml(`<span class="text-red-500">Error running help: ${err.message}</span>`);
          this.cdr.detectChanges();
      });
  }

  private appendOutput(data: string, isError: boolean = false) {
    const html = this.ansiConverter.toHtml(data);
    this.addLine(html);
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
        this.outputContainer.nativeElement.scrollTop = this.outputContainer.nativeElement.scrollHeight;
      }
    }, 0);
  }
}
