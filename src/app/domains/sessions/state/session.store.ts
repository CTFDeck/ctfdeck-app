import { Injectable, OnDestroy, inject } from '@angular/core';
import { BehaviorSubject, Subject, Subscription } from 'rxjs';
import { toast } from 'ngx-sonner';
import { WebSocketService } from '../../../infrastructure/transport/websocket/websocket.service';
import type { SessionData } from '../models/session-data.model';
import type { SessionMetadata } from '../models/session-metadata.model';
import type { SessionTarget } from '../models/session-target.model';
import type { TerminalEvent } from '../models/terminal-event.model';
import { ACTIVE_SESSION_KEY } from '../infrastructure/session.constants';
import { SessionClientService } from '../infrastructure/session-client.service';

@Injectable({ providedIn: 'root' })
export class SessionStore implements OnDestroy {
  private readonly sessions = inject(SessionClientService);
  private readonly ws = inject(WebSocketService);

  private readonly sessionsSubject = new BehaviorSubject<SessionMetadata[]>([]);
  readonly sessions$ = this.sessionsSubject.asObservable();

  private readonly sessionsTotalSubject = new BehaviorSubject<number>(0);
  readonly sessionsTotal$ = this.sessionsTotalSubject.asObservable();

  private readonly sessionsLoadingSubject = new BehaviorSubject<boolean>(false);
  readonly sessionsLoading$ = this.sessionsLoadingSubject.asObservable();

  private readonly activeSessionIdSubject = new BehaviorSubject<string | null>(null);
  readonly activeSessionId$ = this.activeSessionIdSubject.asObservable();

  private readonly unassignedSessionsSubject = new BehaviorSubject<SessionMetadata[]>([]);
  readonly unassignedSessions$ = this.unassignedSessionsSubject.asObservable();

  private readonly unassignedTotalSubject = new BehaviorSubject<number>(0);
  readonly unassignedTotal$ = this.unassignedTotalSubject.asObservable();

  private readonly activeSessionSubject = new BehaviorSubject<SessionData | null>(null);
  readonly activeSession$ = this.activeSessionSubject.asObservable();

  private readonly isLoadingSubject = new BehaviorSubject<boolean>(false);
  readonly isLoading$ = this.isLoadingSubject.asObservable();

  private readonly terminalEventsSubject = new Subject<TerminalEvent>();
  readonly terminalEvents$ = this.terminalEventsSubject.asObservable();

  private readonly subscriptions = new Subscription();
  private creatingSessionPromise: Promise<string> | null = null;
  private readonly sessionsListPromises = new Map<boolean, Promise<void>>();

  constructor() {
    this.subscriptions.add(
      this.ws.isConnected$.subscribe((connected) => {
        if (connected) {
          void this.initializeOnConnect();
        } else {
          this.activeSessionSubject.next(null);
          this.activeSessionIdSubject.next(null);
        }
      }),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  async refreshSessions(
    force = false,
    offset = 0,
    limit = 6,
    unassignedOnly = false,
  ): Promise<void> {
    const currentPromise = this.sessionsListPromises.get(unassignedOnly);

    if (!force && currentPromise && offset === 0) {
      return currentPromise;
    }

    this.sessionsLoadingSubject.next(true);

    const fetchPromise = (async () => {
      try {
        const response = await this.sessions.list(offset, limit, unassignedOnly);

        if (unassignedOnly) {
          this.unassignedTotalSubject.next(response.totalCount);

          if (offset === 0) {
            this.unassignedSessionsSubject.next(response.sessions);
          } else {
            this.unassignedSessionsSubject.next([
              ...this.unassignedSessionsSubject.value,
              ...response.sessions,
            ]);
          }
        } else {
          this.sessionsTotalSubject.next(response.totalCount);

          if (offset === 0) {
            this.sessionsSubject.next(response.sessions);
          } else {
            this.sessionsSubject.next([...this.sessionsSubject.value, ...response.sessions]);
          }
        }
      } catch (error: unknown) {
        toast.error('Session list failed', {
          description: error instanceof Error ? error.message : 'Unknown error',
        });
      } finally {
        this.sessionsLoadingSubject.next(false);
      }
    })();

    if (offset === 0) {
      this.sessionsListPromises.set(unassignedOnly, fetchPromise);

      fetchPromise.finally(() => {
        if (this.sessionsListPromises.get(unassignedOnly) === fetchPromise) {
          this.sessionsListPromises.delete(unassignedOnly);
        }
      });
    }

    return fetchPromise;
  }

  async selectSession(sessionId: string): Promise<void> {
    if (!sessionId) {
      return;
    }

    this.isLoadingSubject.next(true);

    try {
      const setOk = await this.sessions.setActive(sessionId);

      if (!setOk) {
        throw new Error('Failed to set active session');
      }

      const loaded = await this.sessions.load(sessionId);

      if (!loaded.success || !loaded.session) {
        throw new Error('Failed to load session');
      }

      this.activeSessionSubject.next(loaded.session);
      this.activeSessionIdSubject.next(sessionId);
      localStorage.setItem(ACTIVE_SESSION_KEY, sessionId);
    } catch (error: unknown) {
      this.activeSessionSubject.next(null);
      this.activeSessionIdSubject.next(null);
      localStorage.removeItem(ACTIVE_SESSION_KEY);

      toast.error('Session load failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      this.isLoadingSubject.next(false);
    }
  }

  async createSession(name: string): Promise<string> {
    this.isLoadingSubject.next(true);

    try {
      const result = await this.sessions.create(name);

      if (!result.success) {
        throw new Error('Failed to create session');
      }

      await this.selectSession(result.sessionId);
      await Promise.all([
        this.refreshSessions(true, 0, 50, false),
        this.refreshSessions(true, 0, 6, true),
      ]);

      return result.sessionId;
    } catch (error: unknown) {
      toast.error('Session create failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    } finally {
      this.isLoadingSubject.next(false);
    }
  }

  async ensureActiveSession(defaultName = 'New chat'): Promise<string> {
    const activeId = this.activeSessionIdSubject.value;

    if (activeId) {
      return activeId;
    }

    if (this.creatingSessionPromise) {
      return this.creatingSessionPromise;
    }

    this.creatingSessionPromise = this.createSession(defaultName).finally(() => {
      this.creatingSessionPromise = null;
    });

    return this.creatingSessionPromise;
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      const ok = await this.sessions.delete(sessionId);

      if (!ok) {
        throw new Error('Failed to delete session');
      }

      if (this.activeSessionIdSubject.value === sessionId) {
        this.activeSessionSubject.next(null);
        this.activeSessionIdSubject.next(null);
        localStorage.removeItem(ACTIVE_SESSION_KEY);
      }

      await Promise.all([
        this.refreshSessions(true, 0, 50, false),
        this.refreshSessions(true, 0, 6, true),
      ]);
    } catch (error: unknown) {
      toast.error('Session delete failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async renameSession(sessionId: string, name: string, description = ''): Promise<void> {
    try {
      const ok = await this.sessions.update(sessionId, name, description);

      if (!ok) {
        throw new Error('Failed to rename session');
      }

      await Promise.all([
        this.refreshSessions(true, 0, 50, false),
        this.refreshSessions(true, 0, 6, true),
      ]);

      if (this.activeSessionIdSubject.value === sessionId && this.activeSessionSubject.value) {
        this.activeSessionSubject.next({
          ...this.activeSessionSubject.value,
          name,
          description,
        });
      }
    } catch (error: unknown) {
      toast.error('Session update failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async refreshActiveSession(): Promise<void> {
    const sessionId = this.activeSessionIdSubject.value;

    if (!sessionId) {
      return;
    }

    this.isLoadingSubject.next(true);

    try {
      const loaded = await this.sessions.load(sessionId);

      if (loaded.success && loaded.session) {
        this.activeSessionSubject.next(loaded.session);
      }
    } catch (error: unknown) {
      toast.error('Session refresh failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      this.isLoadingSubject.next(false);
    }
  }

  async getSessionData(sessionId: string): Promise<SessionData | null> {
    try {
      const result = await this.sessions.load(sessionId);
      return result.success ? result.session : null;
    } catch {
      return null;
    }
  }

  async addTarget(target: Omit<SessionTarget, 'id'>, sessionId?: string): Promise<void> {
    const targetSessionId = sessionId || (await this.ensureActiveSession());

    const result = await this.sessions.addTarget(
      targetSessionId,
      target.address,
      target.port,
      target.name,
      target.type,
      target.description,
    );

    if (result.success && targetSessionId === this.activeSessionIdSubject.value) {
      await this.refreshActiveSession();
    }
  }

  async editTarget(targetId: string, updates: Omit<SessionTarget, 'id'>): Promise<void> {
    const sessionId = this.activeSessionIdSubject.value;

    if (!sessionId) {
      throw new Error('No active session');
    }

    const ok = await this.sessions.editTarget(
      sessionId,
      targetId,
      updates.address,
      updates.port,
      updates.name,
      updates.type,
      updates.description,
    );

    if (ok) {
      await this.refreshActiveSession();
    }
  }

  async deleteTarget(targetId: string): Promise<void> {
    const sessionId = this.activeSessionIdSubject.value;

    if (!sessionId) {
      throw new Error('No active session');
    }

    const ok = await this.sessions.deleteTarget(sessionId, targetId);

    if (ok) {
      await this.refreshActiveSession();
    }
  }

  getActiveSessionId(): string | null {
    return this.activeSessionIdSubject.value;
  }

  getTotalSessions(unassigned = false): number {
    return unassigned ? this.unassignedTotalSubject.value : this.sessionsTotalSubject.value;
  }

  broadcastTerminalEvent(event: TerminalEvent): void {
    this.terminalEventsSubject.next(event);
  }

  private async initializeOnConnect(): Promise<void> {
    const lastSession = localStorage.getItem(ACTIVE_SESSION_KEY);

    const loadUnassigned = this.refreshSessions(false, 0, 6, true);
    const loadAll = this.refreshSessions(false, 0, 50, false);
    const restoreLastSession = lastSession ? await this.selectSession(lastSession) : await Promise.resolve();

    await Promise.all([loadUnassigned, loadAll, restoreLastSession]);

    if (!this.activeSessionIdSubject.value) {
      const sessions = this.sessionsSubject.value;

      if (sessions.length > 0) {
        const sorted = [...sessions].sort(
          (a, b) => (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0),
        );

        await this.selectSession(sorted[0].id);
      }
    }
  }
}
