import { Component, signal, HostBinding, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HlmButtonImports } from '@ctfdeck/helm/button';
import { HlmSidebarImports } from '@ctfdeck/helm/sidebar';
import { HlmScrollAreaImports } from '@ctfdeck/helm/scroll-area';
import { HlmInputGroupImports } from '@ctfdeck/helm/input-group';
import { HlmInputImports } from '@ctfdeck/helm/input';
import { HlmLabelImports } from '@ctfdeck/helm/label';
import { BrnDialogImports } from '@spartan-ng/brain/dialog';
import { HlmDialogImports } from '@ctfdeck/helm/dialog';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideSearch,
  lucidePlus,
  lucideArrowUp,
  lucideCheck,
  lucideMessageCircleDashed,
  lucidePanelLeft,
  lucidePencil,
  lucideTrash2,
  lucideFileText,
  lucideFolderOpen,
} from '@ng-icons/lucide';
import { SessionStoreService } from '../../app/core/services/session-store.service';
import { SessionMetadata } from '../../app/core/services/session.protocol';
import { WriteUpStoreService } from '../../app/core/services/writeup-store.service';
import { WriteUpMetadata } from '../../app/core/services/writeup.protocol';
import { Observable } from 'rxjs';
import { Router } from '@angular/router';

export enum SidebarMode {
  Chats = 'chats',
  WriteUps = 'writeups',
}

@Component({
  selector: 'ctf-chat-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NgIcon,
    HlmSidebarImports,
    HlmButtonImports,
    HlmScrollAreaImports,
    HlmInputGroupImports,
    ...HlmInputImports,
    ...HlmLabelImports,
    ...BrnDialogImports,
    ...HlmDialogImports,
  ],
  providers: [
    provideIcons({
      lucideSearch,
      lucidePlus,
      lucideArrowUp,
      lucideCheck,
      lucideMessageCircleDashed,
      lucidePanelLeft,
      lucidePencil,
      lucideTrash2,
      lucideFileText,
      lucideFolderOpen,
    }),
  ],

  templateUrl: './chat-sidebar.html',
  styleUrls: ['./chat-sidebar.css'],
})
export class ChatSidebar {
  SidebarMode = SidebarMode;
  currentMode = signal<SidebarMode>(SidebarMode.Chats);

  private readonly STORAGE_KEY = 'ctf_sidebar_mode';

  isCollapsed = signal(false);
  deletingSessionIds = signal<Set<string>>(new Set());
  renameDraftById: Record<string, string> = {};

  @HostBinding('class.w-64')
  get expanded() {
    return !this.isCollapsed();
  }

  @HostBinding('class.w-20') // 5rem = 80px
  get collapsed() {
    return this.isCollapsed();
  }

  search = '';

  sessions$: Observable<SessionMetadata[]>;
  activeSessionId$: Observable<string | null>;
  sessionsLoading$: Observable<boolean>;

  writeUps$: Observable<WriteUpMetadata[]>;
  writeUpsLoading$: Observable<boolean>;
  activeWriteUpId$: Observable<string | null>;

  @ViewChild('renameTrigger') renameTrigger!: ElementRef<HTMLButtonElement>;
  @ViewChild('deleteTrigger') deleteTrigger!: ElementRef<HTMLButtonElement>;

  sessionToRename: SessionMetadata | null = null;
  sessionToDelete: SessionMetadata | null = null;

  writeUpToRename: WriteUpMetadata | null = null;
  writeUpToDelete: WriteUpMetadata | null = null;

  constructor(
    private sessionStore: SessionStoreService,
    private writeUpStore: WriteUpStoreService,
    private router: Router,
  ) {
    this.sessions$ = this.sessionStore.sessions$;
    this.activeSessionId$ = this.sessionStore.activeSessionId$;
    this.sessionsLoading$ = this.sessionStore.sessionsLoading$;

    this.writeUps$ = this.writeUpStore.writeUps$;
    this.writeUpsLoading$ = this.writeUpStore.loading$;
    this.activeWriteUpId$ = new Observable((sub) => {
      this.writeUpStore.activeWriteUp$.subscribe((aw) => sub.next(aw?.id || null));
    });

    // Load persisted mode
    const savedMode = localStorage.getItem(this.STORAGE_KEY) as SidebarMode;
    if (savedMode && Object.values(SidebarMode).includes(savedMode)) {
      this.currentMode.set(savedMode);
    }
  }

  setMode(mode: SidebarMode) {
    this.currentMode.set(mode);
    localStorage.setItem(this.STORAGE_KEY, mode);
  }

  newAction() {
    if (this.currentMode() === SidebarMode.Chats) {
      void this.sessionStore.createSession('New chat').then(() => {
        void this.router.navigate(['/terminal']);
      });
    } else {
      void this.writeUpStore.createWriteUp('New writeup').then((id) => {
        if (id) void this.router.navigate(['/writeup', id]);
      });
    }
  }

  newChat() {
    void this.sessionStore.createSession('New chat');
  }

  openChat(session: SessionMetadata) {
    void this.sessionStore.selectSession(session.id);
    void this.router.navigate(['/terminal']);
  }

  async openWriteUp(writeUp: WriteUpMetadata) {
    await this.writeUpStore.selectWriteUp(writeUp.id);
    void this.router.navigate(['/writeup', writeUp.id]);
  }

  // Rename Logic
  openRenameDialog(session: SessionMetadata) {
    this.sessionToRename = session;
    this.renameDraftById[session.id] = session.name;
    // Defer click to ensure state update propagates if needed, though usually sync is fine here
    setTimeout(() => this.renameTrigger.nativeElement.click());
  }

  async renameSession(ctx: { close: () => void }) {
    if (!this.sessionToRename) return;
    const session = this.sessionToRename;
    const nextName = (this.renameDraftById[session.id] ?? '').trim();

    if (!nextName) return;

    ctx.close();
    await this.sessionStore.renameSession(session.id, nextName, session.description || '');
    this.sessionToRename = null;
  }

  // Delete Logic
  openDeleteDialog(session: SessionMetadata) {
    this.sessionToDelete = session;
    setTimeout(() => this.deleteTrigger.nativeElement.click());
  }

  async deleteSession(ctx: { close: () => void }) {
    if (!this.sessionToDelete) return;
    const session = this.sessionToDelete;

    ctx.close();
    if (this.isDeletingSession(session.id)) return;

    this.setSessionDeleting(session.id, true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 220));
      await this.sessionStore.deleteSession(session.id);
    } finally {
      this.setSessionDeleting(session.id, false);
      this.sessionToDelete = null;
    }
  }

  isDeletingSession(sessionId: string): boolean {
    return this.deletingSessionIds().has(sessionId);
  }

  private setSessionDeleting(sessionId: string, deleting: boolean) {
    const next = new Set(this.deletingSessionIds());
    if (deleting) {
      next.add(sessionId);
    } else {
      next.delete(sessionId);
    }
    this.deletingSessionIds.set(next);
  }

  filteredChats(sessions: SessionMetadata[]) {
    const term = this.search?.toLowerCase().trim();
    if (!term) return sessions;
    return sessions.filter((s) => s.name.toLowerCase().includes(term));
  }

  /** Number of results currently shown by the search filter */
  resultsCount(sessions: SessionMetadata[]): number {
    return this.filteredChats(sessions).length;
  }

  filteredWriteUps(writeUps: WriteUpMetadata[]) {
    const term = this.search?.toLowerCase().trim();
    if (!term) return writeUps;
    return writeUps.filter((w) => w.name.toLowerCase().includes(term));
  }

  toggleSidebar() {
    this.isCollapsed.set(!this.isCollapsed());
  }
}
