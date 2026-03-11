import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { toast } from 'ngx-sonner';

import { BrnTabsImports } from '@spartan-ng/brain/tabs';
import { HlmTabsImports } from '@ctfdeck/helm/tabs';
import { HlmButtonImports } from '@ctfdeck/helm/button';
import { HlmInputImports } from '@ctfdeck/helm/input';
import { HlmLabelImports } from '@ctfdeck/helm/label';
import { BrnSelectImports } from '@spartan-ng/brain/select';
import { HlmSelectImports } from '@ctfdeck/helm/select/src';
import { HlmButtonGroupImports } from '@ctfdeck/helm/button-group';
import { BrnDialogImports } from '@spartan-ng/brain/dialog';
import { HlmDialogImports } from '@ctfdeck/helm/dialog';
import { HlmScrollAreaImports } from '@ctfdeck/helm/scroll-area';
import { BrnAlertDialogImports } from '@spartan-ng/brain/alert-dialog';
import { HlmAlertDialogImports } from '@ctfdeck/helm/alert-dialog/src';

import { HlmIcon } from '@ctfdeck/helm/icon';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideChevronDown,
  lucideChevronUp,
  lucideCpu,
  lucideFileSearch,
  lucideGlobe,
  lucideHash,
  lucideInfo,
  lucideLock,
  lucidePencil,
  lucidePlus,
  lucideSearch,
  lucideShield,
  lucideTarget,
  lucideTerminal,
  lucideTrash2,
} from '@ng-icons/lucide';

import { SessionStoreService } from '../../../core/services/session-store.service';
import { type SessionTarget } from '../../../core/services/session.protocol';
import type { AddTargetForm, EditTargetForm } from '../models/target-form.model';
import type { TargetTypeOption } from '../models/target-type-option.model';
import {
  createEditTargetForm,
  createEmptyAddTargetForm,
  createTargetTypeOptions,
  getTargetIcon,
  getTargetKey,
  getTargetTypeLabel,
} from '../utils/target-manager.utils';

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
    HlmIcon,
    NgIcon,
    BrnSelectImports,
    HlmSelectImports,
    ...HlmButtonGroupImports,
    ...BrnDialogImports,
    ...HlmDialogImports,
    ...HlmScrollAreaImports,
    ...BrnAlertDialogImports,
    ...HlmAlertDialogImports,
  ],
  providers: [
    provideIcons({
      lucideTarget,
      lucideChevronUp,
      lucideChevronDown,
      lucideGlobe,
      lucideHash,
      lucideInfo,
      lucidePencil,
      lucideTrash2,
      lucideShield,
      lucideCpu,
      lucideLock,
      lucideSearch,
      lucideFileSearch,
      lucideTerminal,
      lucidePlus,
    }),
  ],
  templateUrl: './target-manager.component.html',
  styleUrl: './target-manager.component.css',
})
export class TargetManagerComponent implements OnInit, OnDestroy {
  private readonly sessionStore = inject(SessionStoreService);
  private readonly cdr = inject(ChangeDetectorRef);

  @ViewChild('editTrigger') editTrigger!: ElementRef;
  @ViewChild('deleteSingleTrigger') deleteSingleTrigger!: ElementRef;
  @ViewChild('deleteBulkTrigger') deleteBulkTrigger!: ElementRef;

  @Input() mode: 'view' | 'add' | 'delete' = 'view';
  @Output() closeEvent = new EventEmitter<void>();

  targets: SessionTarget[] = [];
  sessions$ = this.sessionStore.sessions$;
  activeSession$ = this.sessionStore.activeSession$;
  activeSessionId = '';
  selectedIds = new Set<string>();
  targetToDelete: SessionTarget | null = null;

  addForm: AddTargetForm = createEmptyAddTargetForm();
  editForm: EditTargetForm = {
    id: '',
    name: '',
    address: '',
    port: undefined,
    description: '',
    type: 0,
    sessionId: '',
  };

  readonly targetTypes: TargetTypeOption[] = createTargetTypeOptions();
  targetToSessions = new Map<string, string[]>();

  private readonly subscriptions = new Subscription();

  ngOnInit(): void {
    this.sessionStore.refreshSessions();

    this.subscriptions.add(
      this.sessionStore.activeSession$.subscribe((session) => {
        this.targets = session?.targets || [];

        const currentTargetIds = new Set(this.targets.map((target) => target.id));
        this.selectedIds.forEach((id) => {
          if (!currentTargetIds.has(id)) {
            this.selectedIds.delete(id);
          }
        });

        if (session && this.addForm.sessionIds.length === 0) {
          this.addForm.sessionIds = [session.id];
        }

        void this.updateTargetSessionMapping();
      }),
    );

    this.subscriptions.add(
      this.sessionStore.sessions$.subscribe(() => {
        void this.updateTargetSessionMapping();
      }),
    );

    this.subscriptions.add(
      this.sessionStore.activeSessionId$.subscribe((id) => {
        this.activeSessionId = id || '';
      }),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  open(mode: 'view' | 'add' | 'delete'): void {
    this.mode = mode;
    void this.sessionStore.refreshActiveSession();
  }

  async addTarget(): Promise<void> {
    if (!this.addForm.name || !this.addForm.address) {
      toast.error('Error', { description: 'Target name and address are required.' });
      return;
    }

    try {
      const sessionIds =
        this.addForm.sessionIds.length > 0
          ? this.addForm.sessionIds
          : [this.sessionStore.getActiveSessionId()!];

      if (!sessionIds.length || sessionIds.includes(null!)) {
        await this.saveTargetToSession(undefined);
      } else {
        for (const sessionId of sessionIds) {
          await this.saveTargetToSession(sessionId);
        }
      }

      this.addForm = createEmptyAddTargetForm(this.sessionStore.getActiveSessionId() || undefined);
      this.setMode('view');

      toast.success('Target added!', {
        description: 'Target successfully saved to selected session(s).',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to add target.';
      toast.error('Error', { description: message });
    }
  }

  getSessionsForTarget(target: SessionTarget): string[] {
    return this.targetToSessions.get(getTargetKey(target)) || [];
  }

  getTargetTypeLabel(type: number): string {
    return getTargetTypeLabel(type, this.targetTypes);
  }

  getTargetIcon(type: number): string {
    return getTargetIcon(type);
  }

  startEditing(target: SessionTarget): void {
    this.editForm = createEditTargetForm(
      target,
      this.sessionStore.getActiveSessionId() || '',
    );

    setTimeout(() => {
      this.editTrigger.nativeElement.click();
    });
  }

  async saveEdit(ctx: { close: () => void }): Promise<void> {
    if (!this.editForm.id) {
      return;
    }

    try {
      const currentSessionId = this.sessionStore.getActiveSessionId();
      const targetSessionId = this.editForm.sessionId;

      if (currentSessionId && targetSessionId && currentSessionId !== targetSessionId) {
        await this.sessionStore.addTarget(
          {
            name: this.editForm.name,
            address: this.editForm.address,
            port: this.editForm.port ?? null,
            description: this.editForm.description || '',
            type: this.editForm.type,
          },
          targetSessionId,
        );

        await this.sessionStore.deleteTarget(this.editForm.id);

        toast.success('Target moved', {
          description: 'Target transferred to another session.',
        });
      } else {
        await this.sessionStore.editTarget(this.editForm.id, {
          name: this.editForm.name,
          address: this.editForm.address,
          port: this.editForm.port ?? null,
          description: this.editForm.description || '',
          type: this.editForm.type,
        });

        toast.success('Changes saved', { description: 'Target updated.' });
      }

      ctx.close();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Target update failed.';
      toast.error('Update failed', { description: message });
    }
  }

  toggleSelection(id: string): void {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
      return;
    }

    this.selectedIds.add(id);
  }

  deleteOneTarget(target: SessionTarget): void {
    this.targetToDelete = target;

    setTimeout(() => {
      this.deleteSingleTrigger.nativeElement.click();
    });
  }

  async confirmDeleteOne(ctx: { close: () => void }): Promise<void> {
    if (!this.targetToDelete) {
      return;
    }

    try {
      await this.sessionStore.deleteTarget(this.targetToDelete.id);

      toast.success('Target deleted', {
        description: `"${this.targetToDelete.name}" removed from configuration.`,
      });

      ctx.close();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Target delete failed.';
      toast.error('Delete failed', { description: message });
    } finally {
      this.targetToDelete = null;
    }
  }

  deleteSelected(): void {
    const idsToDelete = Array.from(this.selectedIds);

    if (idsToDelete.length === 0) {
      return;
    }

    setTimeout(() => {
      this.deleteBulkTrigger.nativeElement.click();
    });
  }

  async confirmDeleteSelected(ctx: { close: () => void }): Promise<void> {
    const idsToDelete = Array.from(this.selectedIds);
    const count = idsToDelete.length;

    try {
      for (const id of idsToDelete) {
        await this.sessionStore.deleteTarget(id);
      }

      this.selectedIds.clear();

      toast.success('Deletion successful', {
        description: `${count} targets removed.`,
        closeButton: true,
      });

      ctx.close();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Bulk delete failed.';
      toast.error('Delete failed', { description: message });
    }
  }

  setMode(mode: 'view' | 'add' | 'delete'): void {
    this.mode = mode;
  }

  async switchSession(sessionId: string): Promise<void> {
    if (!sessionId) {
      return;
    }

    await this.sessionStore.selectSession(sessionId);
  }

  private async saveTargetToSession(sessionId: string | undefined): Promise<void> {
    await this.sessionStore.addTarget(
      {
        name: this.addForm.name,
        address: this.addForm.address,
        port: this.addForm.port ?? null,
        description: this.addForm.description || '',
        type: this.addForm.type,
      },
      sessionId,
    );
  }

  private async updateTargetSessionMapping(): Promise<void> {
    setTimeout(async () => {
      const metas: any[] = [];
      const sub = this.sessionStore.sessions$.subscribe((items) => metas.push(...items));
      sub.unsubscribe();

      const newMap = new Map<string, string[]>();

      for (const meta of metas) {
        const data = await this.sessionStore.getSessionData(meta.id);

        if (!data) {
          continue;
        }

        for (const target of data.targets) {
          const key = getTargetKey(target);
          const list = newMap.get(key) || [];

          if (!list.includes(meta.name)) {
            list.push(meta.name);
            newMap.set(key, list);
          }
        }
      }

      this.targetToSessions = newMap;
      this.cdr.detectChanges();
    }, 0);
  }
}
