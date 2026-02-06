import { Component, EventEmitter, Output, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TargetService, Target } from '../../app/core/services/target.service';

import { BrnTabsImports } from '@spartan-ng/brain/tabs';
import { HlmTabsImports } from '@ctfdeck/helm/tabs';
import { HlmButtonImports } from '@ctfdeck/helm/button';
import { HlmInputImports } from '@ctfdeck/helm/input';
import { HlmLabelImports } from '@ctfdeck/helm/label';

import { HlmIcon } from '../../../libs/ui/icon/src/lib/hlm-icon'; 
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideTarget } from '@ng-icons/lucide';

import { toast } from 'ngx-sonner';

@Component({
  selector: 'app-target-manager',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    BrnTabsImports,
    HlmTabsImports,
    HlmButtonImports,
    HlmInputImports,
    HlmLabelImports,
    NgIcon,
    HlmIcon
  ],
  providers: [
    provideIcons({ lucideTarget })
  ],
  template: `
    <div class="p-8 bg-background text-foreground">
      <div class="mb-8 flex items-center gap-3">
        <ng-icon hlm name="lucideTarget" size="lg" class="text-primary" />
        
        <div>
          <h3 class="text-2xl font-semibold tracking-tight">Target Management</h3>
          <p class="text-sm text-muted-foreground">Configure and oversee your network targets.</p>
        </div>
      </div>

      <hlm-tabs [tab]="mode" class="w-full">
        <hlm-tabs-list class="grid w-full grid-cols-3 mb-6">
          <button hlmTabsTrigger="view" (click)="mode = 'view'">Configuration</button>
          <button hlmTabsTrigger="add" (click)="mode = 'add'">Add Target</button>
          <button hlmTabsTrigger="delete" (click)="mode = 'delete'">Bulk Delete</button>
        </hlm-tabs-list>

        <div hlmTabsContent="view" class="space-y-4 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
          <div *ngIf="targets.length === 0" class="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-xl border-border bg-card/30">
            <p class="text-muted-foreground font-medium">No targets configured.</p>
          </div>

          <div *ngFor="let target of targets" class="group relative flex flex-col gap-2 p-4 rounded-xl border border-border bg-card hover:bg-accent/50 transition-all">
            <div *ngIf="editingId !== target.id" class="flex justify-between items-start">
              <div class="space-y-1">
                <h4 class="font-bold uppercase tracking-wider text-primary">{{ target.name }}</h4>
                <div class="flex items-center gap-2">
                    <code class="px-2 py-0.5 rounded bg-muted text-xs font-mono border border-border">
                        {{ target.host }}{{ target.port ? ':' + target.port : '' }}
                    </code>
                </div>
              </div>
              <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button hlmBtn size="sm" variant="outline" (click)="startEditing(target)">Edit</button>
                <button hlmBtn size="sm" variant="destructive" (click)="deleteOneTarget(target.id)">Delete</button>
              </div>
            </div>

            <div *ngIf="editingId === target.id" class="space-y-3 p-2 animate-in fade-in slide-in-from-top-1">
              <input hlmInput [(ngModel)]="editForm.name" placeholder="Server name" class="w-full" />
              <div class="flex gap-2">
                <input hlmInput [(ngModel)]="editForm.host" placeholder="IP / Host" class="flex-1" />
                <button hlmBtn size="sm" (click)="saveEdit()">Save</button>
                <button hlmBtn size="sm" variant="ghost" (click)="editingId = null">Cancel</button>
              </div>
            </div>
          </div>
        </div>

        <div hlmTabsContent="add" class="space-y-6 pt-2 animate-in fade-in duration-300">
          <div class="space-y-4">
            <div class="grid gap-2">
              <label hlmLabel for="add-name">Resource Name</label>
              <input hlmInput id="add-name" [(ngModel)]="addForm.name" placeholder="e.g., PROD-DB-01" />
            </div>
            <div class="grid grid-cols-3 gap-4">
              <div class="col-span-2 grid gap-2">
                <label hlmLabel for="add-host">IP Address or Hostname</label>
                <input hlmInput id="add-host" [(ngModel)]="addForm.host" placeholder="10.0.0.5" />
              </div>
              <div class="grid gap-2">
                <label hlmLabel for="add-port">Port</label>
                <input hlmInput id="add-port" type="number" [(ngModel)]="addForm.port" placeholder="80" />
              </div>
            </div>
          </div>
          <button hlmBtn class="w-full h-11" (click)="addTarget()">Add to List</button>
        </div>

        <div hlmTabsContent="delete" class="space-y-4 pt-2">
          <div class="rounded-md border border-border overflow-hidden">
            <div *ngFor="let target of targets" 
                 (click)="toggleSelection(target.id)" 
                 [class.bg-accent]="selectedIds.has(target.id)"
                 class="flex items-center gap-3 p-4 border-b border-border last:border-0 cursor-pointer hover:bg-accent/50 transition-colors">
              <div class="h-4 w-4 rounded border border-primary flex items-center justify-center" 
                   [class.bg-primary]="selectedIds.has(target.id)">
                <div *ngIf="selectedIds.has(target.id)" class="text-[10px] text-primary-foreground">✔</div>
              </div>
              <span class="font-medium">{{ target.name }}</span>
              <span class="text-xs text-muted-foreground ml-auto font-mono">{{ target.host }}</span>
            </div>
          </div>
          <button hlmBtn variant="destructive" class="w-full" 
                  [disabled]="selectedIds.size === 0" (click)="deleteSelected()">
            Delete Selection ({{ selectedIds.size }})
          </button>
        </div>
      </hlm-tabs>

      <div class="mt-10 pt-4 border-t border-border flex justify-end">
        <button hlmBtn variant="secondary" (click)="closeEvent.emit()">Close Manager</button>
      </div>
    </div>
  `
})
export class TargetManagerComponent implements OnInit {
  private targetService = inject(TargetService);
  @Input() mode: 'view' | 'add' | 'delete' = 'view';
  @Output() closeEvent = new EventEmitter<void>();

  targets: Target[] = [];
  selectedIds = new Set<string>();
  editingId: string | null = null;
  addForm = { name: '', host: '', port: undefined as number | undefined, description: '' };
  editForm = { name: '', host: '', port: undefined as number | undefined, description: '' };

  ngOnInit() { this.loadTargets(); }
  loadTargets() { this.targets = this.targetService.getTargets(); }

  public open(mode: 'view' | 'add' | 'delete') {
    this.mode = mode;
    this.loadTargets();
  }

  addTarget() {
    if (!this.addForm.name) {
      toast.error('Error', { description: 'Target name is required.' });
      return;
    }
    this.targetService.addTarget({...this.addForm});
    this.addForm = { name: '', host: '', port: undefined, description: '' };
    this.loadTargets();
    this.mode = 'view';
    toast.success('Target added!', { description: 'Target successfully saved.' });
  }

  startEditing(target: Target) {
    this.editingId = target.id;
    this.editForm = { name: target.name, host: target.host, port: target.port, description: target.description || '' };
  }

  saveEdit() {
    if (this.editingId) {
      this.targetService.updateTarget(this.editingId, this.editForm);
      this.editingId = null;
      this.loadTargets();
      toast.success('Changes saved', { description: 'Target updated.' });
    }
  }

  toggleSelection(id: string) {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
  }

  deleteOneTarget(id: string) {
    this.targetService.deleteTarget(id);
    this.loadTargets();
    toast.success('Target deleted', { description: 'Removed from configuration.' });
  }

  deleteSelected() {
    const count = this.selectedIds.size;
    if (count === 0) return;
      this.targetService.deleteTargets(Array.from(this.selectedIds));
      this.selectedIds.clear();
      this.loadTargets();
      toast.error('Deletion successful', { description: `${count} targets removed.`, closeButton: true });
  }
}