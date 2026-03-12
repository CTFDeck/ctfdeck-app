import { Injectable, OnDestroy, inject } from '@angular/core';
import { BehaviorSubject, Subscription, distinctUntilChanged } from 'rxjs';
import { toast } from 'ngx-sonner';
import { SessionStore } from '../../sessions/state/session.store';
import { WriteUpData, WriteUpMetadata } from '../models/writeup.model';
import { WriteUpClientService } from '../infrastructure/writeup-client.service';

const ALL_SESSIONS_ID = '00000000-0000-0000-0000-000000000000';

@Injectable({ providedIn: 'root' })
export class WriteUpStore implements OnDestroy {
  private writeUpClient = inject(WriteUpClientService);
  private sessionStore = inject(SessionStore);

  private writeUpsSubject = new BehaviorSubject<WriteUpMetadata[]>([]);
  readonly writeUps$ = this.writeUpsSubject.asObservable();

  private allWriteUpsSubject = new BehaviorSubject<WriteUpMetadata[]>([]);
  readonly allWriteUps$ = this.allWriteUpsSubject.asObservable();

  private writeUpsTotalSubject = new BehaviorSubject<number>(0);
  readonly writeUpsTotal$ = this.writeUpsTotalSubject.asObservable();

  private allWriteUpsTotalSubject = new BehaviorSubject<number>(0);
  readonly allWriteUpsTotal$ = this.allWriteUpsTotalSubject.asObservable();

  private unassignedWriteUpsSubject = new BehaviorSubject<WriteUpMetadata[]>([]);
  readonly unassignedWriteUps$ = this.unassignedWriteUpsSubject.asObservable();

  private unassignedTotalSubject = new BehaviorSubject<number>(0);
  readonly unassignedTotal$ = this.unassignedTotalSubject.asObservable();

  private writeUpsLoadingSubject = new BehaviorSubject<boolean>(false);
  readonly writeUpsLoading$ = this.writeUpsLoadingSubject.asObservable();

  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  readonly isLoading$ = this.isLoadingSubject.asObservable();

  private activeWriteUpSubject = new BehaviorSubject<WriteUpData | null>(null);
  readonly activeWriteUp$ = this.activeWriteUpSubject.asObservable();

  private subscriptions = new Subscription();

  constructor() {
    this.subscriptions.add(
      this.sessionStore.activeSessionId$.pipe(distinctUntilChanged()).subscribe((sessionId) => {
        if (sessionId) {
          this.refreshWriteUps(sessionId).then(() => {/* Ignore */});
          return;
        }

        this.writeUpsSubject.next([]);
        this.activeWriteUpSubject.next(null);
      }),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  async refreshWriteUps(sessionId?: string, offset = 0, limit = 6): Promise<void> {
    const activeSessionId = sessionId || this.sessionStore.getActiveSessionId();

    if (offset === 0) {
      await Promise.all([
        this.refreshAllWriteUps(0, 6, true),
        this.refreshAllWriteUps(0, 50, false),
      ]);
    }

    if (!activeSessionId) {
      this.writeUpsSubject.next([]);
      return;
    }

    this.writeUpsLoadingSubject.next(true);

    try {
      const result = await this.writeUpClient.list(activeSessionId, offset, limit);
      this.writeUpsTotalSubject.next(result.totalCount);

      if (offset === 0) {
        this.writeUpsSubject.next(result.writeUps);
        return;
      }

      this.writeUpsSubject.next([...this.writeUpsSubject.value, ...result.writeUps]);
    } catch (error: any) {
      toast.error('Failed to load writeups', { description: error?.message || 'Unknown error' });
    } finally {
      this.writeUpsLoadingSubject.next(false);
    }
  }

  async refreshAllWriteUps(
    offset = 0,
    limit = 6,
    unassignedOnly = false,
  ): Promise<void> {
    try {
      const result = await this.writeUpClient.list(ALL_SESSIONS_ID, offset, limit, unassignedOnly);

      if (unassignedOnly) {
        this.unassignedTotalSubject.next(result.totalCount);

        if (offset === 0) {
          this.unassignedWriteUpsSubject.next(result.writeUps);
          return;
        }

        this.unassignedWriteUpsSubject.next([
          ...this.unassignedWriteUpsSubject.value,
          ...result.writeUps,
        ]);
        return;
      }

      this.allWriteUpsTotalSubject.next(result.totalCount);

      if (offset === 0) {
        this.allWriteUpsSubject.next(result.writeUps);
        return;
      }

      this.allWriteUpsSubject.next([...this.allWriteUpsSubject.value, ...result.writeUps]);
    } catch (error) {
      console.error('Failed to refresh all writeups:', error);
    }
  }

  async selectWriteUp(writeUpId: string): Promise<void> {
    this.isLoadingSubject.next(true);

    try {
      const result = await this.writeUpClient.load(writeUpId);

      if (!result.success || !result.writeUp) {
        throw new Error('Failed to load writeup content');
      }

      this.activeWriteUpSubject.next(result.writeUp);
    } catch (error: any) {
      toast.error('Writeup load failed', { description: error?.message || 'Unknown error' });
      this.activeWriteUpSubject.next(null);
    } finally {
      this.isLoadingSubject.next(false);
    }
  }

  async createWriteUp(name: string): Promise<string | null> {
    let sessionId = this.sessionStore.getActiveSessionId();

    if (!sessionId) {
      sessionId = ALL_SESSIONS_ID;
    }

    this.isLoadingSubject.next(true);

    try {
      const result = await this.writeUpClient.create(sessionId, name);

      if (!result.success) {
        return null;
      }

      await this.refreshWriteUps(sessionId === ALL_SESSIONS_ID ? undefined : sessionId);
      await this.selectWriteUp(result.writeUpId);
      return result.writeUpId;
    } catch (error: any) {
      toast.error('Writeup creation failed', { description: error?.message || 'Unknown error' });
      return null;
    } finally {
      this.isLoadingSubject.next(false);
    }
  }

  async saveActiveWriteUp(content: string, name?: string): Promise<boolean> {
    const activeWriteUp = this.activeWriteUpSubject.value;

    if (!activeWriteUp) {
      return false;
    }

    const nextName = name || activeWriteUp.name;
    this.isLoadingSubject.next(true);

    try {
      const success = await this.writeUpClient.update(activeWriteUp.id, nextName, content);

      if (!success) {
        return false;
      }

      this.activeWriteUpSubject.next({
        ...activeWriteUp,
        content,
        name: nextName,
      });

      await this.refreshWriteUps();
      return true;
    } catch (error: any) {
      toast.error('Save failed', { description: error?.message || 'Unknown error' });
      return false;
    } finally {
      this.isLoadingSubject.next(false);
    }
  }

  async deleteWriteUp(writeUpId: string): Promise<void> {
    try {
      const success = await this.writeUpClient.delete(writeUpId);

      if (!success) {
        return;
      }

      if (this.activeWriteUpSubject.value?.id === writeUpId) {
        this.activeWriteUpSubject.next(null);
      }

      await this.refreshWriteUps();
    } catch (error: any) {
      toast.error('Delete failed', { description: error?.message || 'Unknown error' });
    }
  }

  async renameWriteUp(writeUpId: string, newName: string): Promise<void> {
    try {
      const loadResult = await this.writeUpClient.load(writeUpId);

      if (!loadResult.success || !loadResult.writeUp) {
        throw new Error('Failed to load writeup for renaming');
      }

      const success = await this.writeUpClient.update(
        writeUpId,
        newName,
        loadResult.writeUp.content,
      );

      if (!success) {
        return;
      }

      if (this.activeWriteUpSubject.value?.id === writeUpId) {
        this.activeWriteUpSubject.next({
          ...this.activeWriteUpSubject.value,
          name: newName,
        });
      }

      await this.refreshWriteUps();
    } catch (error: any) {
      toast.error('Rename failed', { description: error?.message || 'Unknown error' });
    }
  }

  closeActiveWriteUp(): void {
    this.activeWriteUpSubject.next(null);
  }

  async moveWriteUp(
    writeUpId: string,
    projectId: string | null,
    folderId: string | null,
  ): Promise<boolean> {
    try {
      const success = await this.writeUpClient.move(writeUpId, projectId, folderId);

      if (!success) {
        return false;
      }

      if (this.activeWriteUpSubject.value?.id === writeUpId) {
        const currentWriteUp = this.activeWriteUpSubject.value;
        this.activeWriteUpSubject.next({
          ...currentWriteUp,
          projectId,
          folderId,
        });
      }

      await Promise.all([
        this.refreshAllWriteUps(0, 12, true),
        this.refreshAllWriteUps(0, 50, false),
      ]);

      return true;
    } catch (error: any) {
      toast.error('Move failed', { description: error?.message || 'Unknown error' });
      return false;
    }
  }

  getTotalWriteUps(unassigned = false): number {
    return unassigned ? this.unassignedTotalSubject.value : this.allWriteUpsTotalSubject.value;
  }
}
