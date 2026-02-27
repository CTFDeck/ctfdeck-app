import {
  Component,
  EventEmitter,
  Output,
  Input,
  OnInit,
  OnDestroy,
  inject,
  signal,
  ChangeDetectorRef,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SessionStoreService } from '../../app/core/services/session-store.service';
import { SessionTarget, TargetType } from '../../app/core/services/session.protocol';
import { Subscription } from 'rxjs';

import { BrnTabsImports } from '@spartan-ng/brain/tabs';
import { HlmTabsImports } from '@ctfdeck/helm/tabs';
import { HlmButtonImports } from '@ctfdeck/helm/button';
import { HlmInputImports } from '@ctfdeck/helm/input';
import { HlmLabelImports } from '@ctfdeck/helm/label';
import { BrnSelectImports } from '@spartan-ng/brain/select';
import { HlmSelectImports } from '../../../libs/ui/select/src';
import { HlmButtonGroupImports } from '@ctfdeck/helm/button-group';
import { BrnDialogImports } from '@spartan-ng/brain/dialog';
import { HlmDialogImports } from '@ctfdeck/helm/dialog';
import { HlmScrollAreaImports } from '../../../libs/ui/scroll-area/src';
import { BrnAlertDialogImports } from '@spartan-ng/brain/alert-dialog';
import { HlmAlertDialogImports } from '../../../libs/ui/alert-dialog/src';

import { HlmIcon } from '../../../libs/ui/icon/src/lib/hlm-icon';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
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
} from '@ng-icons/lucide';

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
  private sessionStore = inject(SessionStoreService);
  private cdr = inject(ChangeDetectorRef);

  @ViewChild('editTrigger') editTrigger!: ElementRef;
  @ViewChild('deleteSingleTrigger') deleteSingleTrigger!: ElementRef;
  @ViewChild('deleteBulkTrigger') deleteBulkTrigger!: ElementRef;

  @Input() mode: 'view' | 'add' | 'delete' = 'view';
  @Output() closeEvent = new EventEmitter<void>();

  targets: SessionTarget[] = [];
  sessions$ = this.sessionStore.sessions$;
  activeSession$ = this.sessionStore.activeSession$;
  activeSessionId: string = '';
  selectedIds = new Set<string>();
  targetToDelete: SessionTarget | null = null;
  targetsToDelete: string[] = [];
  addForm = {
    name: '',
    address: '',
    port: undefined as number | undefined,
    description: '',
    type: TargetType.Unknown,
    sessionIds: [] as string[],
  };
  editForm = {
    id: '',
    name: '',
    address: '',
    port: undefined as number | undefined,
    description: '',
    type: TargetType.Unknown,
    sessionId: '',
  };

  targetTypes = [
    { label: 'Unknown', value: TargetType.Unknown },
    { label: 'Web', value: TargetType.Web },
    { label: 'Pwn', value: TargetType.Pwn },
    { label: 'Crypto', value: TargetType.Crypto },
    { label: 'Forensics', value: TargetType.Forensics },
    { label: 'Reverse', value: TargetType.Reverse },
    { label: 'Misc', value: TargetType.Misc },
  ];

  // Mapping of "address:port" -> list of session names
  targetToSessions = new Map<string, string[]>();

  private subscriptions = new Subscription();

  ngOnInit() {
    this.sessionStore.refreshSessions();
    this.subscriptions.add(
      this.sessionStore.activeSession$.subscribe((session) => {
        this.targets = session?.targets || [];

        // Keep only IDs that still exist in the updated targets list
        const currentTargetIds = new Set(this.targets.map((t) => t.id));
        this.selectedIds.forEach((id) => {
          if (!currentTargetIds.has(id)) {
            this.selectedIds.delete(id);
          }
        });



        // Pre-select current session in add form if available
        if (session && this.addForm.sessionIds.length === 0) {
          this.addForm.sessionIds = [session.id];
        }

        this.updateTargetSessionMapping();
      }),
    );

    this.subscriptions.add(
      this.sessionStore.sessions$.subscribe(() => {
        this.updateTargetSessionMapping();
      }),
    );

    this.subscriptions.add(
      this.sessionStore.activeSessionId$.subscribe((id) => {
        this.activeSessionId = id || '';
      }),
    );
  }

  private getTargetKey(target: { address: string; port?: number | null }): string {
    return `${target.address}${target.port ? ':' + target.port : ''}`;
  }

  private async updateTargetSessionMapping() {
    const sessions = this.sessionStore.getActiveSessionId()
      ? [this.sessionStore.getActiveSessionId()!]
      : [];

    // Using a micro-task to avoid blocking
    setTimeout(async () => {
      // Get current list of session metas
      const metas: any[] = [];
      const sub = this.sessionStore.sessions$.subscribe((m) => metas.push(...m));
      sub.unsubscribe();

      const newMap = new Map<string, string[]>();

      // Load details for each session to find targets
      for (const meta of metas) {
        const data = await this.sessionStore.getSessionData(meta.id);
        if (data) {
          for (const target of data.targets) {
            const key = this.getTargetKey(target);
            const list = newMap.get(key) || [];
            if (!list.includes(meta.name)) {
              list.push(meta.name);
              newMap.set(key, list);
            }
          }
        }
      }

      this.targetToSessions = newMap;
      this.cdr.detectChanges();
    }, 0);
  }

  getSessionsForTarget(target: SessionTarget): string[] {
    return this.targetToSessions.get(this.getTargetKey(target)) || [];
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  public open(mode: 'view' | 'add' | 'delete') {
    this.mode = mode;
    void this.sessionStore.refreshActiveSession();
  }

  async addTarget() {
    if (!this.addForm.name || !this.addForm.address) {
      toast.error('Error', { description: 'Target name and address are required.' });
      return;
    }

    try {
      // If no sessions selected, default to current one (handled by service if undefined passed, but we enforce specific ID now)
      // Actually service handles undefined by ensuring active session.
      // But if we have multiple selected, we loop.

      const sessionIds =
        this.addForm.sessionIds.length > 0
          ? this.addForm.sessionIds
          : [this.sessionStore.getActiveSessionId()!]; // Fallback to current if none selected, though UI should probably enforce selection or default.

      if (!sessionIds.length || sessionIds.includes(null!)) {
        // Fallback if really nothing is there
        await this.saveTargetToSession(undefined);
      } else {
        for (const sessionId of sessionIds) {
          await this.saveTargetToSession(sessionId);
        }
      }

      this.addForm = {
        name: '',
        address: '',
        port: undefined,
        description: '',
        type: TargetType.Unknown,
        sessionIds: [],
      };
      // Reset session selection to active one
      const activeId = this.sessionStore.getActiveSessionId();
      if (activeId) {
        this.addForm.sessionIds = [activeId];
      }

      this.setMode('view');
      toast.success('Target added!', {
        description: 'Target successfully saved to selected session(s).',
      });
    } catch (err: any) {
      toast.error('Error', { description: err?.message || 'Failed to add target.' });
    }
  }

  private async saveTargetToSession(sessionId: string | undefined) {
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

  getTargetTypeLabel(type: number): string {
    return this.targetTypes.find((t) => t.value === type)?.label || 'Unknown';
  }

  getTargetIcon(type: number): string {
    switch (type) {
      case TargetType.Web:
        return 'lucideGlobe';
      case TargetType.Pwn:
        return 'lucideTerminal';
      case TargetType.Crypto:
        return 'lucideLock';
      case TargetType.Forensics:
        return 'lucideSearch';
      case TargetType.Reverse:
        return 'lucideCpu';
      case TargetType.Misc:
        return 'lucideHash';
      default:
        return 'lucideTarget';
    }
  }

  startEditing(target: SessionTarget) {
    this.editForm = {
      id: target.id,
      name: target.name,
      address: target.address,
      port: target.port ?? undefined,
      description: target.description || '',
      type: target.type,
      sessionId: this.sessionStore.getActiveSessionId() || '',
    };
    setTimeout(() => {
      this.editTrigger.nativeElement.click();
    });
  }

  async saveEdit(ctx: any) {
    if (!this.editForm.id) return;
    try {
      const currentSessionId = this.sessionStore.getActiveSessionId();
      const targetSessionId = this.editForm.sessionId;

      if (currentSessionId && targetSessionId && currentSessionId !== targetSessionId) {
        // Mode move: add to new, then delete from old
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
        toast.success('Target moved', { description: 'Target transferred to another session.' });
      } else {
        // Regular update
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
    } catch (err: any) {
      toast.error('Update failed', { description: err?.message || 'Target update failed.' });
    }
  }

  toggleSelection(id: string) {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
  }

  async deleteOneTarget(target: SessionTarget) {
    this.targetToDelete = target;
    setTimeout(() => {
      this.deleteSingleTrigger.nativeElement.click();
    });
  }

  async confirmDeleteOne(ctx: any) {
    if (!this.targetToDelete) return;
    try {
      await this.sessionStore.deleteTarget(this.targetToDelete.id);
      toast.success('Target deleted', {
        description: `"${this.targetToDelete.name}" removed from configuration.`,
      });
      ctx.close();
    } catch (err: any) {
      toast.error('Delete failed', { description: err?.message || 'Target delete failed.' });
    } finally {
      this.targetToDelete = null;
    }
  }

  async deleteSelected() {
    const idsToDelete = Array.from(this.selectedIds);
    if (idsToDelete.length === 0) return;
    setTimeout(() => {
      this.deleteBulkTrigger.nativeElement.click();
    });
  }

  async confirmDeleteSelected(ctx: any) {
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
    } catch (err: any) {
      toast.error('Delete failed', { description: err?.message || 'Bulk delete failed.' });
    }
  }

  setMode(mode: 'view' | 'add' | 'delete') {
    this.mode = mode;
  }

  async switchSession(sessionId: string) {
    if (!sessionId) return;
    await this.sessionStore.selectSession(sessionId);
  }
}
