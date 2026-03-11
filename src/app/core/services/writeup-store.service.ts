import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subscription, distinctUntilChanged } from 'rxjs';
import { WriteUpService } from './writeup.service';
import { SessionStoreService } from './session-store.service';
import { WriteUpMetadata, WriteUpData } from './writeup.protocol';
import { toast } from 'ngx-sonner';

@Injectable({ providedIn: 'root' })
export class WriteUpStoreService implements OnDestroy {
  private writeUpsSubject = new BehaviorSubject<WriteUpMetadata[]>([]);
  writeUps$ = this.writeUpsSubject.asObservable();

  private allWriteUpsSubject = new BehaviorSubject<WriteUpMetadata[]>([]);
  allWriteUps$ = this.allWriteUpsSubject.asObservable();

  private writeUpsTotalSubject = new BehaviorSubject<number>(0);
  writeUpsTotal$ = this.writeUpsTotalSubject.asObservable();

  private allWriteUpsTotalSubject = new BehaviorSubject<number>(0);
  allWriteUpsTotal$ = this.allWriteUpsTotalSubject.asObservable();

  private unassignedWriteUpsSubject = new BehaviorSubject<WriteUpMetadata[]>([]);
  unassignedWriteUps$ = this.unassignedWriteUpsSubject.asObservable();

  private unassignedTotalSubject = new BehaviorSubject<number>(0);
  unassignedTotal$ = this.unassignedTotalSubject.asObservable();

  private writeUpsLoadingSubject = new BehaviorSubject<boolean>(false);
  writeUpsLoading$ = this.writeUpsLoadingSubject.asObservable();

  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  isLoading$ = this.isLoadingSubject.asObservable();

  private activeWriteUpSubject = new BehaviorSubject<WriteUpData | null>(null);
  activeWriteUp$ = this.activeWriteUpSubject.asObservable();

  private subscriptions = new Subscription();

  constructor(
    private writeUpService: WriteUpService,
    private sessionStore: SessionStoreService,
  ) {
    this.subscriptions.add(
      this.sessionStore.activeSessionId$
        .pipe(distinctUntilChanged())
        .subscribe((sessionId) => {
          if (sessionId) {
            this.refreshWriteUps(sessionId);
          } else {
            this.writeUpsSubject.next([]);
            this.activeWriteUpSubject.next(null);
          }
        })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  async refreshWriteUps(sessionId?: string, offset: number = 0, limit: number = 6): Promise<void> {
    const sid = sessionId || this.sessionStore.getActiveSessionId();
    
    // Refresh ALL writeups (unassigned for sidebar, all for hierarchy)
    if (offset === 0) {
      await Promise.all([
         this.refreshAllWriteUps(0, 6, true),
         this.refreshAllWriteUps(0, 50, false)
      ]);
    }

    if (!sid) {
       this.writeUpsSubject.next([]);
       return;
    }

    this.writeUpsLoadingSubject.next(true);
    try {
      const res = await this.writeUpService.list(sid, offset, limit);
      this.writeUpsTotalSubject.next(res.totalCount);
      if (offset === 0) {
        this.writeUpsSubject.next(res.writeUps);
      } else {
        this.writeUpsSubject.next([...this.writeUpsSubject.value, ...res.writeUps]);
      }
    } catch (err: any) {
      toast.error('Failed to load writeups', { description: err?.message || 'Unknown error' });
    } finally {
      this.writeUpsLoadingSubject.next(false);
    }
  }

  async refreshAllWriteUps(offset: number = 0, limit: number = 6, unassignedOnly: boolean = false): Promise<void> {
     try {
       // Send zero UUID for "All"
       const res = await this.writeUpService.list('00000000-0000-0000-0000-000000000000', offset, limit, unassignedOnly);
       if (unassignedOnly) {
         this.unassignedTotalSubject.next(res.totalCount);
         if (offset === 0) {
           this.unassignedWriteUpsSubject.next(res.writeUps);
         } else {
           this.unassignedWriteUpsSubject.next([...this.unassignedWriteUpsSubject.value, ...res.writeUps]);
         }
       } else {
         this.allWriteUpsTotalSubject.next(res.totalCount);
         if (offset === 0) {
           this.allWriteUpsSubject.next(res.writeUps);
         } else {
           this.allWriteUpsSubject.next([...this.allWriteUpsSubject.value, ...res.writeUps]);
         }
       }
     } catch (e) {
       console.error('Failed to refresh all writeups:', e);
     }
  }

  async selectWriteUp(writeUpId: string): Promise<void> {
    this.isLoadingSubject.next(true);
    try {
      const result = await this.writeUpService.load(writeUpId);
      if (result.success && result.writeUp) {
        this.activeWriteUpSubject.next(result.writeUp);
      } else {
        throw new Error('Failed to load writeup content');
      }
    } catch (err: any) {
      toast.error('Writeup load failed', { description: err?.message || 'Unknown error' });
      this.activeWriteUpSubject.next(null);
    } finally {
      this.isLoadingSubject.next(false);
    }
  }

  async createWriteUp(name: string): Promise<string | null> {
    let sessionId = this.sessionStore.getActiveSessionId();
    if (!sessionId) {
      sessionId = '00000000-0000-0000-0000-000000000000';
    }

    this.isLoadingSubject.next(true);
    try {
      const result = await this.writeUpService.create(sessionId, name);
      if (result.success) {
        await this.refreshWriteUps(sessionId === '00000000-0000-0000-0000-000000000000' ? undefined : sessionId);
        await this.selectWriteUp(result.writeUpId);
        return result.writeUpId;
      }
      return null;
    } catch (err: any) {
      toast.error('Writeup creation failed', { description: err?.message || 'Unknown error' });
      return null;
    } finally {
      this.isLoadingSubject.next(false);
    }
  }

  async saveActiveWriteUp(content: string, name?: string): Promise<boolean> {
    const active = this.activeWriteUpSubject.value;
    if (!active) return false;

    const newName = name || active.name;

    this.isLoadingSubject.next(true);
    try {
      const success = await this.writeUpService.update(active.id, newName, content);
      if (success) {
        this.activeWriteUpSubject.next({ ...active, content, name: newName });
        await this.refreshWriteUps();
        return true;
      }
      return false;
    } catch (err: any) {
      toast.error('Save failed', { description: err?.message || 'Unknown error' });
      return false;
    } finally {
      this.isLoadingSubject.next(false);
    }
  }

  async deleteWriteUp(writeUpId: string): Promise<void> {
    try {
      const success = await this.writeUpService.delete(writeUpId);
      if (success) {
        if (this.activeWriteUpSubject.value?.id === writeUpId) {
          this.activeWriteUpSubject.next(null);
        }
        await this.refreshWriteUps();
      }
    } catch (err: any) {
      toast.error('Delete failed', { description: err?.message || 'Unknown error' });
    }
  }

  async renameWriteUp(writeUpId: string, newName: string): Promise<void> {
    try {
      // We need content to update, so load it first
      const loadResult = await this.writeUpService.load(writeUpId);
      if (!loadResult.success || !loadResult.writeUp) {
        throw new Error('Failed to load writeup for renaming');
      }

      const success = await this.writeUpService.update(writeUpId, newName, loadResult.writeUp.content);
      if (success) {
        if (this.activeWriteUpSubject.value?.id === writeUpId) {
          this.activeWriteUpSubject.next({ ...this.activeWriteUpSubject.value, name: newName });
        }
        await this.refreshWriteUps();
      }
    } catch (err: any) {
      toast.error('Rename failed', { description: err?.message || 'Unknown error' });
    }
  }

  closeActiveWriteUp(): void {
    this.activeWriteUpSubject.next(null);
  }

  async moveWriteUp(writeUpId: string, projectId: string | null, folderId: string | null): Promise<boolean> {
    try {
      const success = await this.writeUpService.move(writeUpId, projectId, folderId);
      if (success) {
        if (this.activeWriteUpSubject.value?.id === writeUpId) {
          const current = this.activeWriteUpSubject.value;
          this.activeWriteUpSubject.next({ ...current, projectId, folderId });
        }
        // Refresh both lists to update sidebar and hierarchy
        await Promise.all([
          this.refreshAllWriteUps(0, 12, true),
          this.refreshAllWriteUps(0, 50, false)
        ]);
        return true;
      }
      return false;
    } catch (err: any) {
      toast.error('Move failed', { description: err?.message || 'Unknown error' });
      return false;
    }
  }

  getTotalWriteUps(unassigned = false): number {
    return unassigned ? this.unassignedTotalSubject.value : this.allWriteUpsTotalSubject.value;
  }
}
