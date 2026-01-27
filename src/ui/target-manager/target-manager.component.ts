import { Component, EventEmitter, Output, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TargetService, Target } from '../../app/core/services/target.service';

@Component({
  selector: 'app-target-manager',
  standalone: true,
  imports: [CommonModule],
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
      
      <!-- Contenu temporaire -->
      <div class="min-h-[300px] flex items-center justify-center">
        <div class="text-center">
          <p class="text-lg text-gray-600 dark:text-gray-400 mb-4">
            Modal Target Manager créée avec succès !
          </p>
          <p class="text-sm text-gray-500">
            Mode actuel : <span class="font-semibold">{{ mode }}</span>
          </p>
          <p class="text-xs text-gray-400 mt-4">
            Les fonctionnalités d'ajout, édition et suppression seront implémentées dans les prochaines issues.
          </p>
        </div>
      </div>
      
      <!-- Footer -->
      <div class="flex justify-end gap-3 mt-6 pt-4 border-t">
        <button 
          (click)="close()" 
          class="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-400 transition"
        >
          Fermer
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class TargetManagerComponent {
  @Input() mode: 'view' | 'add' | 'delete' = 'view';
  @Output() closeEvent = new EventEmitter<void>();
  
  constructor(private targetService: TargetService) {}
  
  open(mode: 'view' | 'add' | 'delete') {
    this.mode = mode;
  }
  
  close() {
    this.closeEvent.emit();
  }
}