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
  lucideFolderPlus,
  lucideMoreVertical,
  lucideChevronRight,
  lucideChevronDown,
  lucideLayoutGrid,
  lucideFolderOpen,
  lucideFolder,
  lucideBox,
  lucideMessageSquarePlus,
  lucideFilePlus,
} from '@ng-icons/lucide';
import { SessionStoreService } from '../../app/core/services/session-store.service';
import { SessionMetadata } from '../../app/core/services/session.protocol';
import { WriteUpStoreService } from '../../app/core/services/writeup-store.service';
import { WriteUpMetadata } from '../../app/core/services/writeup.protocol';
import { Observable } from 'rxjs';
import { Router } from '@angular/router';
import { ProjectStoreService, ProjectHierarchy } from '../../app/core/services/project-store.service';

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
      lucideFolderPlus,
      lucideMoreVertical,
      lucideChevronRight,
      lucideChevronDown,
      lucideLayoutGrid,
      lucideFolderOpen,
      lucideFolder,
      lucideBox,
      lucideMessageSquarePlus,
      lucideFilePlus,
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

  // Session delete animation tracking
  deletingSessionIds = signal<Set<string>>(new Set());
  // WriteUp delete animation tracking
  deletingWriteUpIds = signal<Set<string>>(new Set());

  renameDraftById: Record<string, string> = {};

  @HostBinding('class.w-64')
  get expanded() {
    return !this.isCollapsed();
  }

  @HostBinding('class.w-20')
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

  // Session dialog state
  @ViewChild('renameTrigger') renameTrigger!: ElementRef<HTMLButtonElement>;
  @ViewChild('deleteTrigger') deleteTrigger!: ElementRef<HTMLButtonElement>;
  sessionToRename: SessionMetadata | null = null;
  sessionToDelete: SessionMetadata | null = null;

  // WriteUp dialog state
  @ViewChild('renameWriteUpTrigger') renameWriteUpTrigger!: ElementRef<HTMLButtonElement>;
  @ViewChild('deleteWriteUpTrigger') deleteWriteUpTrigger!: ElementRef<HTMLButtonElement>;
  writeUpToRename: WriteUpMetadata | null = null;
  writeUpToDelete: WriteUpMetadata | null = null;

  // Project & Folder dialog state
  @ViewChild('createProjectTrigger') createProjectTrigger!: ElementRef<HTMLButtonElement>;
  @ViewChild('createFolderTrigger') createFolderTrigger!: ElementRef<HTMLButtonElement>;
  @ViewChild('renameFolderTrigger') renameFolderTrigger!: ElementRef<HTMLButtonElement>;
  @ViewChild('deleteFolderTrigger') deleteFolderTrigger!: ElementRef<HTMLButtonElement>;

  createProjectDraft = { name: '', description: '' };
  createFolderDraft = { projectId: '', parentId: null as string | null, name: '' };
  folderToRenameDraft = { projectId: '', folderId: '', name: '' };
  folderToDeleteDraft = { projectId: '', folderId: '', name: '' };

  hierarchy$: Observable<ProjectHierarchy[]>;
  expandedProjectIds = signal<Set<string>>(new Set());
  expandedFolderIds = signal<Set<string>>(new Set());

  constructor(
    private sessionStore: SessionStoreService,
    private writeUpStore: WriteUpStoreService,
    private projectStore: ProjectStoreService,
    private router: Router,
  ) {
    this.hierarchy$ = this.projectStore.getHierarchy$();
    this.sessions$ = this.sessionStore.sessions$;
    this.activeSessionId$ = this.sessionStore.activeSessionId$;
    this.sessionsLoading$ = this.sessionStore.sessionsLoading$;

    this.writeUps$ = this.writeUpStore.allWriteUps$;
    this.writeUpsLoading$ = this.writeUpStore.writeUpsLoading$;
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

  newProject() {
    this.createProjectDraft = { name: 'New Project', description: '' };
    setTimeout(() => this.createProjectTrigger.nativeElement.click());
  }

  async createProject(ctx: { close: () => void }) {
    const name = this.createProjectDraft.name.trim();
    if (!name) return;
    ctx.close();
    await this.projectStore.createProject(name, this.createProjectDraft.description);
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

  newWriteUp() {
    void this.writeUpStore.createWriteUp('New writeup');
  }

  openChat(session: SessionMetadata) {
    void this.sessionStore.selectSession(session.id);
    void this.router.navigate(['/terminal']);
  }

  async openWriteUp(writeUp: WriteUpMetadata) {
    await this.writeUpStore.selectWriteUp(writeUp.id);
    void this.router.navigate(['/writeup', writeUp.id]);
  }

  // ── Session: Rename ─────────────────────────────────────────────────────
  openRenameDialog(session: SessionMetadata) {
    this.sessionToRename = session;
    this.renameDraftById[session.id] = session.name;
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

  // ── Session: Delete ──────────────────────────────────────────────────────
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
    if (deleting) next.add(sessionId); else next.delete(sessionId);
    this.deletingSessionIds.set(next);
  }

  // ── WriteUp: Rename ──────────────────────────────────────────────────────
  openRenameWriteUpDialog(writeUp: WriteUpMetadata) {
    this.writeUpToRename = writeUp;
    this.renameDraftById[writeUp.id] = writeUp.name;
    setTimeout(() => this.renameWriteUpTrigger.nativeElement.click());
  }

  async renameWriteUp(ctx: { close: () => void }) {
    if (!this.writeUpToRename) return;
    const writeUp = this.writeUpToRename;
    const nextName = (this.renameDraftById[writeUp.id] ?? '').trim();
    if (!nextName) return;
    ctx.close();
    await this.writeUpStore.renameWriteUp(writeUp.id, nextName);
    this.writeUpToRename = null;
  }

  // ── WriteUp: Delete ──────────────────────────────────────────────────────
  openDeleteWriteUpDialog(writeUp: WriteUpMetadata) {
    this.writeUpToDelete = writeUp;
    setTimeout(() => this.deleteWriteUpTrigger.nativeElement.click());
  }

  async deleteWriteUp(ctx: { close: () => void }) {
    if (!this.writeUpToDelete) return;
    const writeUp = this.writeUpToDelete;
    ctx.close();
    if (this.isDeletingWriteUp(writeUp.id)) return;
    this.setWriteUpDeleting(writeUp.id, true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 220));
      await this.writeUpStore.deleteWriteUp(writeUp.id);
    } finally {
      this.setWriteUpDeleting(writeUp.id, false);
      this.writeUpToDelete = null;
    }
  }

  isDeletingWriteUp(writeUpId: string): boolean {
    return this.deletingWriteUpIds().has(writeUpId);
  }

  private setWriteUpDeleting(writeUpId: string, deleting: boolean) {
    const next = new Set(this.deletingWriteUpIds());
    if (deleting) next.add(writeUpId); else next.delete(writeUpId);
    this.deletingWriteUpIds.set(next);
  }

  // ── Filters ──────────────────────────────────────────────────────────────
  filteredChats(sessions: SessionMetadata[]) {
    const term = this.search?.toLowerCase().trim();
    if (!term) return sessions;
    return sessions.filter((s) => s.name.toLowerCase().includes(term));
  }

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

  toggleProject(projectId: string) {
    const next = new Set(this.expandedProjectIds());
    if (next.has(projectId)) next.delete(projectId); else next.add(projectId);
    this.expandedProjectIds.set(next);
    if (next.has(projectId)) {
      void this.projectStore.loadProjectDetails(projectId);
    }
  }

  toggleFolder(folderId: string) {
    const next = new Set(this.expandedFolderIds());
    if (next.has(folderId)) next.delete(folderId); else next.add(folderId);
    this.expandedFolderIds.set(next);
  }

  isProjectExpanded(projectId: string): boolean {
    return this.expandedProjectIds().has(projectId);
  }

  isFolderExpanded(folderId: string): boolean {
    return this.expandedFolderIds().has(folderId);
  }

  // ── Folder CRUD ──────────────────────────────────────────────────────────
  async openCreateFolderDialog(projectId: string, parentId: string | null = null) {
    this.createFolderDraft = { projectId, parentId, name: 'New folder' };
    setTimeout(() => this.createFolderTrigger.nativeElement.click());
  }

  async addFolder(ctx: { close: () => void }) {
    const { projectId, parentId, name } = this.createFolderDraft;
    const trimmedName = name.trim();
    if (!trimmedName) return;
    
    ctx.close();
    await this.projectStore.addFolder(projectId, trimmedName, parentId);
    if (parentId) {
      this.expandedFolderIds.update(s => new Set(s).add(parentId));
    }
  }

  async openRenameFolderDialog(projectId: string, folderId: string, currentName: string) {
    this.folderToRenameDraft = { projectId, folderId, name: currentName };
    setTimeout(() => this.renameFolderTrigger.nativeElement.click());
  }

  async renameFolder(ctx: { close: () => void }) {
    const { projectId, folderId, name } = this.folderToRenameDraft;
    const trimmedName = name.trim();
    if (!trimmedName) return;
    
    ctx.close();
    await this.projectStore.renameFolder(projectId, folderId, trimmedName);
  }

  async openDeleteFolderDialog(projectId: string, folderId: string, name: string) {
    this.folderToDeleteDraft = { projectId, folderId, name };
    setTimeout(() => this.deleteFolderTrigger.nativeElement.click());
  }

  async deleteFolder(ctx: { close: () => void }) {
    const { projectId, folderId } = this.folderToDeleteDraft;
    ctx.close();
    await this.projectStore.deleteFolder(projectId, folderId);
  }

  // ── Drag & Drop ────────────────────────────────────────────────────────
  onDragStart(event: DragEvent, type: 'session' | 'writeup', id: string) {
    if (event.dataTransfer) {
      event.dataTransfer.setData('application/ctf-type', type);
      event.dataTransfer.setData('application/ctf-id', id);
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  async onDrop(event: DragEvent, projectId: string, folderId: string | null) {
    event.preventDefault();
    const type = event.dataTransfer?.getData('application/ctf-type');
    const id = event.dataTransfer?.getData('application/ctf-id');

    if (!type || !id) return;

    try {
      if (type === 'session') {
        await this.projectStore.assignSession(projectId, id, folderId);
      } else if (type === 'writeup') {
        await this.writeUpStore.moveWriteUp(id, folderId);
      }
    } catch (e) {
      console.error('[ChatSidebar] Drop failed:', e);
    }
  }
}
