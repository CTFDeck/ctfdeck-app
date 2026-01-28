import { Component, EventEmitter, Output, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TargetService, Target } from '../../app/core/services/target.service';

@Component({
  selector: 'app-target-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="target-manager p-6">
      <!-- Header -->
      <div class="flex justify-between items-center mb-6 border-b pb-4">
        <h2 class="text-2xl font-bold">
          {{ mode === 'view' ? '📋 Configuration des cibles' : 
             mode === 'add' ? '➕ Ajouter une cible' : 
             '🗑️ Supprimer des cibles' }}
        </h2>
        <button 
          (click)="close()" 
          class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl font-bold"
          aria-label="Fermer"
        >
          ×
        </button>
      </div>
      
      <!-- Contenu selon le mode -->
      <div [ngSwitch]="mode" class="min-h-[300px]">
        
        <!-- MODE VIEW/EDIT -->
        <div *ngSwitchCase="'view'" class="space-y-4">
          <div *ngIf="targets.length === 0" class="bg-blue-50 dark:bg-blue-900/20 p-6 rounded text-center">
            <p class="text-gray-600 dark:text-gray-400">Aucune cible configurée.</p>
            <button 
              (click)="switchMode('add')"
              class="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Ajouter votre première cible
            </button>
          </div>

          <div *ngIf="targets.length > 0" class="space-y-3">
            <div 
              *ngFor="let target of targets" 
              class="bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition"
            >
              <div *ngIf="editingId !== target.id" class="flex justify-between items-start">
                <div class="flex-1">
                  <h4 class="font-semibold text-lg">{{ target.name }}</h4>
                  <p class="text-sm text-gray-600 dark:text-gray-400">
                    🎯 {{ target.host }}{{ target.port ? ':' + target.port : '' }}
                  </p>
                  <p *ngIf="target.description" class="text-sm text-gray-500 mt-1">
                    {{ target.description }}
                  </p>
                  <p class="text-xs text-gray-400 mt-2">
                    Créé le {{ target.createdAt | date:'short' }}
                  </p>
                </div>
                <div class="flex gap-2">
                  <button 
                    (click)="startEditing(target)"
                    class="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                  >
                    ✏️ Éditer
                  </button>
                  <button 
                    (click)="deleteOneTarget(target.id)"
                    class="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              <!-- Formulaire d'édition inline -->
              <div *ngIf="editingId === target.id" class="space-y-3">
                <input 
                  [(ngModel)]="editForm.name"
                  placeholder="Nom de la cible"
                  class="w-full px-3 py-2 border rounded dark:bg-slate-700 dark:border-gray-600"
                />
                <div class="flex gap-2">
                  <input 
                    [(ngModel)]="editForm.host"
                    placeholder="Host (IP/domain)"
                    class="flex-1 px-3 py-2 border rounded dark:bg-slate-700 dark:border-gray-600"
                  />
                  <input 
                    [(ngModel)]="editForm.port"
                    type="number"
                    placeholder="Port"
                    class="w-24 px-3 py-2 border rounded dark:bg-slate-700 dark:border-gray-600"
                  />
                </div>
                <textarea 
                  [(ngModel)]="editForm.description"
                  placeholder="Description (optionnel)"
                  rows="2"
                  class="w-full px-3 py-2 border rounded dark:bg-slate-700 dark:border-gray-600"
                ></textarea>
                <div class="flex gap-2">
                  <button 
                    (click)="saveEdit()"
                    class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    💾 Sauvegarder
                  </button>
                  <button 
                    (click)="cancelEdit()"
                    class="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-400"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- MODE ADD -->
        <div *ngSwitchCase="'add'" class="space-y-4">
          <form (ngSubmit)="addTarget()" class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-1">Nom de la cible *</label>
              <input 
                [(ngModel)]="addForm.name"
                name="name"
                type="text" 
                required
                placeholder="Ex: Serveur Web Production"
                class="w-full px-3 py-2 border rounded dark:bg-slate-700 dark:border-gray-600"
              />
            </div>

            <div class="grid grid-cols-3 gap-4">
              <div class="col-span-2">
                <label class="block text-sm font-medium mb-1">Host (IP ou domaine) *</label>
                <input 
                  [(ngModel)]="addForm.host"
                  name="host"
                  type="text" 
                  required
                  placeholder="Ex: 192.168.1.100 ou example.com"
                  class="w-full px-3 py-2 border rounded dark:bg-slate-700 dark:border-gray-600"
                />
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">Port</label>
                <input 
                  [(ngModel)]="addForm.port"
                  name="port"
                  type="number" 
                  placeholder="80"
                  class="w-full px-3 py-2 border rounded dark:bg-slate-700 dark:border-gray-600"
                />
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium mb-1">Description</label>
              <textarea 
                [(ngModel)]="addForm.description"
                name="description"
                rows="3"
                placeholder="Notes supplémentaires sur cette cible..."
                class="w-full px-3 py-2 border rounded dark:bg-slate-700 dark:border-gray-600"
              ></textarea>
            </div>

            <div *ngIf="errorMessage" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded">
              {{ errorMessage }}
            </div>

            <div class="flex justify-end gap-3 pt-4">
              <button 
                type="button"
                (click)="close()" 
                class="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-400"
              >
                Annuler
              </button>
              <button 
                type="submit"
                class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                ➕ Ajouter la cible
              </button>
            </div>
          </form>
        </div>
        
        <!-- MODE DELETE -->
        <div *ngSwitchCase="'delete'" class="space-y-4">
          <div *ngIf="targets.length === 0" class="bg-red-50 dark:bg-red-900/20 p-6 rounded text-center">
            <p class="text-gray-600 dark:text-gray-400">Aucune cible à supprimer.</p>
          </div>

          <div *ngIf="targets.length > 0" class="space-y-3">
            <p class="text-sm text-gray-600 dark:text-gray-400">
              Sélectionnez les cibles à supprimer :
            </p>
            
            <div 
              *ngFor="let target of targets" 
              class="bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-slate-700 transition cursor-pointer"
              (click)="toggleSelection(target.id)"
            >
              <label class="flex items-start gap-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  [checked]="selectedIds.has(target.id)"
                  (click)="$event.stopPropagation()"
                  (change)="toggleSelection(target.id)"
                  class="mt-1"
                />
                <div class="flex-1">
                  <h4 class="font-semibold">{{ target.name }}</h4>
                  <p class="text-sm text-gray-600 dark:text-gray-400">
                    {{ target.host }}{{ target.port ? ':' + target.port : '' }}
                  </p>
                </div>
              </label>
            </div>

            <div class="flex justify-between items-center pt-4 border-t">
              <p class="text-sm text-gray-600 dark:text-gray-400">
                {{ selectedIds.size }} cible(s) sélectionnée(s)
              </p>
              <div class="flex gap-3">
                <button 
                  (click)="close()" 
                  class="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-400"
                >
                  Annuler
                </button>
                <button 
                  (click)="deleteSelected()"
                  [disabled]="selectedIds.size === 0"
                  [class.opacity-50]="selectedIds.size === 0"
                  [class.cursor-not-allowed]="selectedIds.size === 0"
                  class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:hover:bg-red-600"
                >
                  🗑️ Supprimer ({{ selectedIds.size }})
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class TargetManagerComponent implements OnInit {
  private targetService = inject(TargetService);

  @Input() mode: 'view' | 'add' | 'delete' = 'view';
  @Output() closeEvent = new EventEmitter<void>();

  targets: Target[] = [];
  selectedIds = new Set<string>();
  errorMessage = '';

  addForm = {
    name: '',
    host: '',
    port: undefined as number | undefined,
    description: ''
  };

  editingId: string | null = null;
  editForm = {
    name: '',
    host: '',
    port: undefined as number | undefined,
    description: ''
  };

  ngOnInit() {
    this.loadTargets();
  }

  loadTargets() {
    this.targets = this.targetService.getTargets();
  }

  open(mode: 'view' | 'add' | 'delete') {
    this.mode = mode;
    this.loadTargets();
    this.resetForms();
  }

  switchMode(mode: 'view' | 'add' | 'delete') {
    this.mode = mode;
    this.resetForms();
  }

  // ADD
  addTarget() {
    this.errorMessage = '';

    if (!this.addForm.name.trim() || !this.addForm.host.trim()) {
      this.errorMessage = 'Le nom et le host sont obligatoires';
      return;
    }

    try {
      this.targetService.addTarget({
        name: this.addForm.name.trim(),
        host: this.addForm.host.trim(),
        port: this.addForm.port,
        description: this.addForm.description.trim() || undefined
      });

      this.resetForms();
      this.loadTargets();
      this.mode = 'view';
    } catch (error) {
      this.errorMessage = 'Erreur lors de l\'ajout de la cible';
      console.error(error);
    }
  }

  // EDIT
  startEditing(target: Target) {
    this.editingId = target.id;
    this.editForm = {
      name: target.name,
      host: target.host,
      port: target.port,
      description: target.description || ''
    };
  }

  saveEdit() {
    if (!this.editingId) return;

    const success = this.targetService.updateTarget(this.editingId, {
      name: this.editForm.name.trim(),
      host: this.editForm.host.trim(),
      port: this.editForm.port,
      description: this.editForm.description.trim() || undefined
    });

    if (success) {
      this.loadTargets();
      this.cancelEdit();
    }
  }

  cancelEdit() {
    this.editingId = null;
    this.editForm = { name: '', host: '', port: undefined, description: '' };
  }

  toggleSelection(id: string) {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
  }

  deleteOneTarget(id: string) {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette cible ?')) {
      this.targetService.deleteTarget(id);
      this.loadTargets();
    }
  }

  deleteSelected() {
    if (this.selectedIds.size === 0) return;

    if (confirm(`Supprimer ${this.selectedIds.size} cible(s) ?`)) {
      this.targetService.deleteTargets(Array.from(this.selectedIds));
      this.selectedIds.clear();
      this.loadTargets();
    }
  }

  resetForms() {
    this.addForm = { name: '', host: '', port: undefined, description: '' };
    this.editForm = { name: '', host: '', port: undefined, description: '' };
    this.editingId = null;
    this.selectedIds.clear();
    this.errorMessage = '';
  }

  close() {
    this.resetForms();
    this.closeEvent.emit();
  }
}