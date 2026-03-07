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

  private loadingSubject = new BehaviorSubject<boolean>(false);
  loading$ = this.loadingSubject.asObservable();

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

  async refreshWriteUps(sessionId?: string): Promise<void> {
    const sid = sessionId || this.sessionStore.getActiveSessionId();
    if (!sid) return;

    this.loadingSubject.next(true);
    try {
      const list = await this.writeUpService.list(sid);
      this.writeUpsSubject.next(list);
    } catch (err: any) {
      toast.error('Failed to load writeups', { description: err?.message || 'Unknown error' });
    } finally {
      this.loadingSubject.next(false);
    }
  }

  async selectWriteUp(writeUpId: string): Promise<void> {
    this.loadingSubject.next(true);
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
      this.loadingSubject.next(false);
    }
  }

  async createWriteUp(name: string): Promise<string | null> {
    const sessionId = this.sessionStore.getActiveSessionId();
    if (!sessionId) {
      toast.error('No active session', { description: 'Please select a session first' });
      return null;
    }

    this.loadingSubject.next(true);
    try {
      const result = await this.writeUpService.create(sessionId, name);
      if (result.success) {
        await this.refreshWriteUps(sessionId);
        await this.selectWriteUp(result.writeUpId);
        return result.writeUpId;
      }
      return null;
    } catch (err: any) {
      toast.error('Writeup creation failed', { description: err?.message || 'Unknown error' });
      return null;
    } finally {
      this.loadingSubject.next(false);
    }
  }

  async saveActiveWriteUp(content: string, name?: string): Promise<boolean> {
    const active = this.activeWriteUpSubject.value;
    if (!active) return false;

    const newName = name || active.name;

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
}
