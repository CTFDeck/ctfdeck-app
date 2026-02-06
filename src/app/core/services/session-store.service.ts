import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subscription, Subject } from 'rxjs';
import { SessionService } from './session.service';
import { WebSocketService } from './websocket.service';
import { SessionData, SessionMetadata, SessionTarget } from './session.protocol';
import { toast } from 'ngx-sonner';

const ACTIVE_SESSION_KEY = 'ctfdeck_active_session_id';

@Injectable({ providedIn: 'root' })
export class SessionStoreService implements OnDestroy {
  private sessionsSubject = new BehaviorSubject<SessionMetadata[]>([]);
  sessions$ = this.sessionsSubject.asObservable();

  private sessionsLoadingSubject = new BehaviorSubject<boolean>(false);
  sessionsLoading$ = this.sessionsLoadingSubject.asObservable();

  private activeSessionIdSubject = new BehaviorSubject<string | null>(null);
  activeSessionId$ = this.activeSessionIdSubject.asObservable();

  private activeSessionSubject = new BehaviorSubject<SessionData | null>(null);
  activeSession$ = this.activeSessionSubject.asObservable();

  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  isLoading$ = this.isLoadingSubject.asObservable();

  private terminalEventsSubject = new Subject<TerminalEvent>();
  terminalEvents$ = this.terminalEventsSubject.asObservable();

  private subscriptions = new Subscription();
  private creatingSessionPromise: Promise<string> | null = null;
  private sessionsListPromise: Promise<void> | null = null;

  constructor(private sessions: SessionService, private ws: WebSocketService) {
    this.subscriptions.add(
      this.ws.isConnected$.subscribe((connected) => {
        if (connected) {
          this.initializeOnConnect();
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

  async refreshSessions(force = false): Promise<void> {
    if (!force && this.sessionsListPromise) {
      return this.sessionsListPromise;
    }

    this.sessionsLoadingSubject.next(true);
    this.sessionsListPromise = (async () => {
      try {
        const list = await this.sessions.list();
        this.sessionsSubject.next(list);
      } catch (err: any) {
        toast.error('Session list failed', { description: err?.message || 'Unknown error' });
      } finally {
        this.sessionsLoadingSubject.next(false);
        this.sessionsListPromise = null;
      }
    })();

    return this.sessionsListPromise;
  }

  async selectSession(sessionId: string): Promise<void> {
    if (!sessionId) return;
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
    } catch (err: any) {
      this.activeSessionSubject.next(null);
      this.activeSessionIdSubject.next(null);
      localStorage.removeItem(ACTIVE_SESSION_KEY);
      toast.error('Session load failed', { description: err?.message || 'Unknown error' });
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
      await this.refreshSessions(true);
      return result.sessionId;
    } catch (err: any) {
      toast.error('Session create failed', { description: err?.message || 'Unknown error' });
      throw err;
    } finally {
      this.isLoadingSubject.next(false);
    }
  }

  async ensureActiveSession(defaultName: string = 'New chat'): Promise<string> {
    const activeId = this.activeSessionIdSubject.value;
    if (activeId) return activeId;

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
      await this.refreshSessions(true);
    } catch (err: any) {
      toast.error('Session delete failed', { description: err?.message || 'Unknown error' });
    }
  }

  async renameSession(sessionId: string, name: string, description: string = ''): Promise<void> {
    try {
      const ok = await this.sessions.update(sessionId, name, description);
      if (!ok) {
        throw new Error('Failed to rename session');
      }
      await this.refreshSessions(true);
      if (this.activeSessionIdSubject.value === sessionId && this.activeSessionSubject.value) {
        this.activeSessionSubject.next({
          ...this.activeSessionSubject.value,
          name,
          description,
        });
      }
    } catch (err: any) {
      toast.error('Session update failed', { description: err?.message || 'Unknown error' });
    }
  }

  async refreshActiveSession(): Promise<void> {
    const sessionId = this.activeSessionIdSubject.value;
    if (!sessionId) return;
    this.isLoadingSubject.next(true);
    try {
      const loaded = await this.sessions.load(sessionId);
      if (loaded.success && loaded.session) {
        this.activeSessionSubject.next(loaded.session);
      }
    } catch (err: any) {
      toast.error('Session refresh failed', { description: err?.message || 'Unknown error' });
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
    // Only refresh if we modified the currently active session
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

  private async initializeOnConnect(): Promise<void> {
    const lastSession = localStorage.getItem(ACTIVE_SESSION_KEY);
    const loadSessions = this.refreshSessions();
    const restoreLastSession = lastSession ? this.selectSession(lastSession) : Promise.resolve();
    await Promise.all([loadSessions, restoreLastSession]);
  }

  getActiveSessionId(): string | null {
    return this.activeSessionIdSubject.value;
  }

  broadcastTerminalEvent(event: TerminalEvent) {
    this.terminalEventsSubject.next(event);
  }
}

export interface TerminalEvent {
  type: 'command' | 'output' | 'error';
  content: string;
}
