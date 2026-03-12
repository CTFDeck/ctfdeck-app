import { CdkScrollable } from '@angular/cdk/scrolling';
import { Overlay } from '@angular/cdk/overlay';
import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostBinding, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { BRN_TOOLTIP_SCROLL_STRATEGY } from '@spartan-ng/brain/tooltip';
import { BrnDialogImports } from '@spartan-ng/brain/dialog';
import { HlmButtonImports } from '@ctfdeck/helm/button';
import { HlmDialogImports } from '@ctfdeck/helm/dialog';
import { HlmInputGroupImports } from '@ctfdeck/helm/input-group';
import { HlmInputImports } from '@ctfdeck/helm/input';
import { HlmLabelImports } from '@ctfdeck/helm/label';
import { HlmScrollAreaImports } from '@ctfdeck/helm/scroll-area';
import { HlmSidebarImports } from '@ctfdeck/helm/sidebar';
import { HlmTooltipImports } from '@ctfdeck/helm/tooltip';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowUp,
  lucideBox,
  lucideCheck,
  lucideChevronDown,
  lucideChevronRight,
  lucideChevronUp,
  lucideColumns2,
  lucideFilePlus,
  lucideFileText,
  lucideFolder,
  lucideFolderOpen,
  lucideFolderPlus,
  lucideLayoutGrid,
  lucideMessageCircleDashed,
  lucideMessageSquarePlus,
  lucideMoreVertical,
  lucidePanelLeft,
  lucidePencil,
  lucidePlus,
  lucideSearch,
  lucideTrash2,
} from '@ng-icons/lucide';
import { Observable, firstValueFrom } from 'rxjs';
import { ProjectHierarchy } from '../../domains/projects/models/project-hierarchy.model';
import { ProjectStore } from '../../domains/projects/state/project.store';
import { SessionMetadata } from '../../domains/sessions/models/session-metadata.model';
import { SessionStore } from '../../domains/sessions/state/session.store';
import { WriteUpMetadata } from '../../domains/writeups/models/writeup.model';
import { WriteUpStore } from '../../domains/writeups/state/writeup.store';

@Component({
  selector: 'ctf-workspace-sidebar',
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
    ...HlmTooltipImports,
    CdkScrollable,
  ],
  providers: [
    {
      provide: BRN_TOOLTIP_SCROLL_STRATEGY,
      useFactory: (overlay: Overlay) => () => overlay.scrollStrategies.close(),
      deps: [Overlay],
    },
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
      lucideColumns2,
      lucideChevronUp,
      lucideFilePlus,
    }),
  ],
  templateUrl: './workspace-sidebar.component.html',
  styleUrls: ['./workspace-sidebar.component.css'],
})
export class WorkspaceSidebarComponent {
  isCollapsed = signal(false);

  deletingSessionIds = signal<Set<string>>(new Set());
  deletingWriteUpIds = signal<Set<string>>(new Set());

  renameDraftById: Record<string, string> = {};

  @HostBinding('class.w-64')
  get expanded(): boolean {
    return !this.isCollapsed();
  }

  @HostBinding('class.w-20')
  get collapsed(): boolean {
    return this.isCollapsed();
  }

  search = '';
  sessionsDisplayLimit = signal(5);
  writeUpsDisplayLimit = signal(5);

  sessions$: Observable<SessionMetadata[]>;
  activeSessionId$: Observable<string | null>;
  sessionsLoading$: Observable<boolean>;

  writeUps$: Observable<WriteUpMetadata[]>;
  writeUpsLoading$: Observable<boolean>;
  activeWriteUpId$: Observable<string | null>;

  totalProjectsCount$: Observable<number>;
  totalSessions$: Observable<number>;
  totalWriteUps$: Observable<number>;

  @ViewChild('renameTrigger') renameTrigger!: ElementRef<HTMLButtonElement>;
  @ViewChild('deleteTrigger') deleteTrigger!: ElementRef<HTMLButtonElement>;
  sessionToRename: SessionMetadata | null = null;
  sessionToDelete: SessionMetadata | null = null;

  @ViewChild('renameWriteUpTrigger') renameWriteUpTrigger!: ElementRef<HTMLButtonElement>;
  @ViewChild('deleteWriteUpTrigger') deleteWriteUpTrigger!: ElementRef<HTMLButtonElement>;
  writeUpToRename: WriteUpMetadata | null = null;
  writeUpToDelete: WriteUpMetadata | null = null;

  @ViewChild('createProjectTrigger') createProjectTrigger!: ElementRef<HTMLButtonElement>;
  @ViewChild('createFolderTrigger') createFolderTrigger!: ElementRef<HTMLButtonElement>;
  @ViewChild('renameFolderTrigger') renameFolderTrigger!: ElementRef<HTMLButtonElement>;
  @ViewChild('deleteFolderTrigger') deleteFolderTrigger!: ElementRef<HTMLButtonElement>;
  @ViewChild('newItemTrigger') newItemTrigger!: ElementRef<HTMLButtonElement>;

  createProjectDraft = { name: '', description: '' };
  createFolderDraft = { projectId: '', parentId: null as string | null, name: '' };
  folderToRenameDraft = { projectId: '', folderId: '', name: '' };
  folderToDeleteDraft = { projectId: '', folderId: '', name: '' };
  newItemDraft = { name: '', type: 'session' as 'session' | 'writeup' };
  successfullyDroppedId = signal<string | null>(null);
  isDragging = signal(false);
  isScrolling = signal(false);

  hoveredFolderId = signal<string | null>(null);
  private folderExpandTimeout: ReturnType<typeof setTimeout> | null = null;
  private scrollTimeout: ReturnType<typeof setTimeout> | null = null;
  private dragScrollInterval: ReturnType<typeof setInterval> | null = null;

  @ViewChild('scrollContainer', { read: ElementRef }) scrollContainer!: ElementRef;
  hierarchy$: Observable<ProjectHierarchy[]>;
  expandedProjectIds = signal<Set<string>>(new Set());
  expandedFolderIds = signal<Set<string>>(new Set());

  protected readonly projectStore = inject(ProjectStore);

  constructor(
    private sessionStore: SessionStore,
    private writeUpStore: WriteUpStore,
    private router: Router,
  ) {
    this.hierarchy$ = this.projectStore.getHierarchy$();
    this.sessions$ = this.sessionStore.unassignedSessions$;
    this.activeSessionId$ = this.sessionStore.activeSessionId$;
    this.sessionsLoading$ = this.sessionStore.sessionsLoading$;

    this.writeUps$ = this.writeUpStore.unassignedWriteUps$;
    this.writeUpsLoading$ = this.writeUpStore.writeUpsLoading$;
    this.totalProjectsCount$ = this.projectStore.totalProjectsCount$;
    this.totalSessions$ = this.sessionStore.unassignedTotal$;
    this.totalWriteUps$ = this.writeUpStore.unassignedTotal$;
    this.activeWriteUpId$ = new Observable((subscriber) => {
      this.writeUpStore.activeWriteUp$.subscribe((activeWriteUp) => subscriber.next(activeWriteUp?.id || null));
    });
  }

  newProject(): void {
    this.createProjectDraft = { name: 'New Project', description: '' };
    setTimeout(() => this.createProjectTrigger.nativeElement.click());
  }

  async createProject(ctx: { close: () => void }): Promise<void> {
    const name = this.createProjectDraft.name.trim();
    if (!name) {
      return;
    }

    ctx.close();
    await this.projectStore.createProject(name, this.createProjectDraft.description);
  }

  newChat(): void {
    this.newItemDraft = { name: '', type: 'session' };
    setTimeout(() => this.newItemTrigger.nativeElement.click());
  }

  newWriteUp(): void {
    this.newItemDraft = { name: '', type: 'writeup' };
    setTimeout(() => this.newItemTrigger.nativeElement.click());
  }

  async confirmCreateItem(ctx: { close: () => void }): Promise<void> {
    const defaultName = this.newItemDraft.type === 'session' ? 'New chat' : 'New writeup';
    const name = this.newItemDraft.name.trim() || defaultName;

    ctx.close();

    if (this.newItemDraft.type === 'session') {
      await this.sessionStore.createSession(name);
      void this.router.navigate(['/terminal']);
      return;
    }

    const id = await this.writeUpStore.createWriteUp(name);
    if (id) {
      void this.router.navigate(['/writeup', id]);
    }
  }

  openChat(session: SessionMetadata): void {
    void this.sessionStore.selectSession(session.id);
    void this.router.navigate(['/terminal']);
  }

  async openWriteUp(writeUp: WriteUpMetadata): Promise<void> {
    await this.writeUpStore.selectWriteUp(writeUp.id);
    void this.router.navigate(['/writeup', writeUp.id]);
  }

  openRenameDialog(session: SessionMetadata): void {
    this.sessionToRename = session;
    this.renameDraftById[session.id] = session.name;
    setTimeout(() => this.renameTrigger.nativeElement.click());
  }

  async renameSession(ctx: { close: () => void }): Promise<void> {
    if (!this.sessionToRename) {
      return;
    }

    const session = this.sessionToRename;
    const nextName = (this.renameDraftById[session.id] ?? '').trim();
    if (!nextName) {
      return;
    }

    ctx.close();
    await this.sessionStore.renameSession(session.id, nextName, session.description || '');
    this.sessionToRename = null;
  }

  openDeleteDialog(session: SessionMetadata): void {
    this.sessionToDelete = session;
    setTimeout(() => this.deleteTrigger.nativeElement.click());
  }

  async deleteSession(ctx: { close: () => void }): Promise<void> {
    if (!this.sessionToDelete) {
      return;
    }

    const session = this.sessionToDelete;
    ctx.close();

    if (this.isDeletingSession(session.id)) {
      return;
    }

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

  private setSessionDeleting(sessionId: string, deleting: boolean): void {
    const next = new Set(this.deletingSessionIds());
    if (deleting) {
      next.add(sessionId);
    } else {
      next.delete(sessionId);
    }
    this.deletingSessionIds.set(next);
  }

  openRenameWriteUpDialog(writeUp: WriteUpMetadata): void {
    this.writeUpToRename = writeUp;
    this.renameDraftById[writeUp.id] = writeUp.name;
    setTimeout(() => this.renameWriteUpTrigger.nativeElement.click());
  }

  async renameWriteUp(ctx: { close: () => void }): Promise<void> {
    if (!this.writeUpToRename) {
      return;
    }

    const writeUp = this.writeUpToRename;
    const nextName = (this.renameDraftById[writeUp.id] ?? '').trim();
    if (!nextName) {
      return;
    }

    ctx.close();
    await this.writeUpStore.renameWriteUp(writeUp.id, nextName);
    this.writeUpToRename = null;
  }

  openDeleteWriteUpDialog(writeUp: WriteUpMetadata): void {
    this.writeUpToDelete = writeUp;
    setTimeout(() => this.deleteWriteUpTrigger.nativeElement.click());
  }

  async deleteWriteUp(ctx: { close: () => void }): Promise<void> {
    if (!this.writeUpToDelete) {
      return;
    }

    const writeUp = this.writeUpToDelete;
    ctx.close();

    if (this.isDeletingWriteUp(writeUp.id)) {
      return;
    }

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

  private setWriteUpDeleting(writeUpId: string, deleting: boolean): void {
    const next = new Set(this.deletingWriteUpIds());
    if (deleting) {
      next.add(writeUpId);
    } else {
      next.delete(writeUpId);
    }
    this.deletingWriteUpIds.set(next);
  }

  resultsCount(sessions: SessionMetadata[]): number {
    return this.filteredChats(sessions).length;
  }

  toggleSidebar(): void {
    this.isCollapsed.set(!this.isCollapsed());
  }

  toggleProject(projectId: string): void {
    const next = new Set(this.expandedProjectIds());
    if (next.has(projectId)) {
      next.delete(projectId);
    } else {
      next.add(projectId);
    }
    this.expandedProjectIds.set(next);

    if (next.has(projectId)) {
      void this.projectStore.loadProjectDetails(projectId);
    }
  }

  toggleFolder(folderId: string): void {
    const next = new Set(this.expandedFolderIds());
    if (next.has(folderId)) {
      next.delete(folderId);
    } else {
      next.add(folderId);
    }
    this.expandedFolderIds.set(next);
  }

  isProjectExpanded(projectId: string): boolean {
    return this.expandedProjectIds().has(projectId);
  }

  isFolderExpanded(folderId: string): boolean {
    return this.expandedFolderIds().has(folderId);
  }

  openCreateFolderDialog(projectId: string, parentId: string | null = null): void {
    this.createFolderDraft = { projectId, parentId, name: 'New folder' };
    setTimeout(() => this.createFolderTrigger.nativeElement.click());
  }

  async addFolder(ctx: { close: () => void }): Promise<void> {
    const { projectId, parentId, name } = this.createFolderDraft;
    const trimmedName = name.trim();
    if (!trimmedName) {
      return;
    }

    ctx.close();
    await this.projectStore.addFolder(projectId, trimmedName, parentId);

    if (parentId) {
      this.expandedFolderIds.update((state) => new Set(state).add(parentId));
    }
  }

  openRenameFolderDialog(projectId: string, folderId: string, currentName: string): void {
    this.folderToRenameDraft = { projectId, folderId, name: currentName };
    setTimeout(() => this.renameFolderTrigger.nativeElement.click());
  }

  async renameFolder(ctx: { close: () => void }): Promise<void> {
    const { projectId, folderId, name } = this.folderToRenameDraft;
    const trimmedName = name.trim();
    if (!trimmedName) {
      return;
    }

    ctx.close();
    await this.projectStore.renameFolder(projectId, folderId, trimmedName);
  }

  openDeleteFolderDialog(projectId: string, folderId: string, name: string): void {
    this.folderToDeleteDraft = { projectId, folderId, name };
    setTimeout(() => this.deleteFolderTrigger.nativeElement.click());
  }

  async deleteFolder(ctx: { close: () => void }): Promise<void> {
    const { projectId, folderId } = this.folderToDeleteDraft;
    ctx.close();
    await this.projectStore.deleteFolder(projectId, folderId);
  }

  onDragStart(event: DragEvent, type: 'session' | 'writeup', id: string): void {
    if (event.dataTransfer) {
      event.dataTransfer.setData('application/ctf-type', type);
      event.dataTransfer.setData('application/ctf-id', id);
      event.dataTransfer.effectAllowed = 'move';
    }

    this.isDragging.set(true);
  }

  onDragEnd(): void {
    this.isDragging.set(false);
    this.clearDragScroll();
    this.clearFolderExpandTimer();
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }

    this.isScrolling.set(true);
    this.handleDragScroll(event);
  }

  onFolderDragOver(event: DragEvent, id: string, type: 'project' | 'folder' = 'folder'): void {
    event.preventDefault();
    this.handleDragScroll(event);

    const isExpanded = type === 'project' ? this.isProjectExpanded(id) : this.isFolderExpanded(id);

    if (isExpanded) {
      if (this.hoveredFolderId() === id) {
        this.clearFolderExpandTimer();
      }
      return;
    }

    if (this.hoveredFolderId() !== id) {
      this.clearFolderExpandTimer();
      this.hoveredFolderId.set(id);

      this.folderExpandTimeout = setTimeout(() => {
        if (this.hoveredFolderId() === id) {
          if (type === 'project') {
            const next = new Set(this.expandedProjectIds());
            next.add(id);
            this.expandedProjectIds.set(next);
            void this.projectStore.loadProjectDetails(id);
          } else {
            const next = new Set(this.expandedFolderIds());
            next.add(id);
            this.expandedFolderIds.set(next);
          }

          this.clearFolderExpandTimer();
        }
      }, 450);
    }
  }

  onFolderDragLeave(event: DragEvent): void {
    const target = event.relatedTarget as HTMLElement | null;
    if (target && (target.closest('.ctf-folder-node') || target.closest('.ctf-folder-content'))) {
      return;
    }

    this.clearFolderExpandTimer();
  }

  private clearFolderExpandTimer(): void {
    if (this.folderExpandTimeout) {
      clearTimeout(this.folderExpandTimeout);
      this.folderExpandTimeout = null;
    }

    this.hoveredFolderId.set(null);
  }

  onScroll(): void {
    this.isScrolling.set(true);

    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }

    this.scrollTimeout = setTimeout(() => {
      this.isScrolling.set(false);
    }, 150);
  }

  private handleDragScroll(event: DragEvent): void {
    if (!this.scrollContainer?.nativeElement) {
      return;
    }

    const container = this.scrollContainer.nativeElement;
    const rect = container.getBoundingClientRect();
    const threshold = 60;
    const speed = 8;
    const mouseY = event.clientY;
    const fromTop = mouseY - rect.top;
    const fromBottom = rect.bottom - mouseY;

    this.clearDragScroll();

    if (fromTop < threshold && container.scrollTop > 0) {
      this.dragScrollInterval = setInterval(() => {
        container.scrollTop -= speed;
        if (container.scrollTop <= 0) {
          this.clearDragScroll();
        }
      }, 16);
      return;
    }

    if (fromBottom < threshold && container.scrollTop + container.clientHeight < container.scrollHeight) {
      this.dragScrollInterval = setInterval(() => {
        container.scrollTop += speed;
        if (container.scrollTop + container.clientHeight >= container.scrollHeight) {
          this.clearDragScroll();
        }
      }, 16);
    }
  }

  private clearDragScroll(): void {
    if (this.dragScrollInterval) {
      clearInterval(this.dragScrollInterval);
      this.dragScrollInterval = null;
    }
  }

  async onDrop(event: DragEvent, projectId: string, folderId: string | null): Promise<void> {
    event.preventDefault();
    this.clearDragScroll();
    this.clearFolderExpandTimer();

    const type = event.dataTransfer?.getData('application/ctf-type') as 'session' | 'writeup' | null;
    const id = event.dataTransfer?.getData('application/ctf-id');

    if (!type || !id) {
      return;
    }

    if (id === folderId) {
      return;
    }

    try {
      let success = false;

      if (type === 'session') {
        const result = await this.projectStore.assignSession(projectId, id, folderId);
        success = Boolean(result);
      } else {
        success = await this.writeUpStore.moveWriteUp(id, projectId, folderId);
      }

      if (success) {
        await this.projectStore.loadProjectDetails(projectId);
        this.successfullyDroppedId.set(id);
        setTimeout(() => this.successfullyDroppedId.set(null), 2500);
      }
    } catch (error) {
      console.error(`[WorkspaceSidebarComponent] Drop failed for ${type} ${id}:`, error);
    }
  }

  async loadMoreProjects(): Promise<void> {
    const projects = await firstValueFrom(this.projectStore.projects$);
    await this.projectStore.loadProjects(projects.length, 6);
  }

  async loadMoreSessions(): Promise<void> {
    this.sessionsDisplayLimit.update((count) => count + 6);
    const sessions = await firstValueFrom(this.sessions$);
    await this.sessionStore.refreshSessions(true, sessions.length, 12, true);
  }

  async loadMoreWriteUps(): Promise<void> {
    this.writeUpsDisplayLimit.update((count) => count + 6);
    const writeUps = await firstValueFrom(this.writeUps$);
    await this.writeUpStore.refreshAllWriteUps(writeUps.length, 12, true);
  }

  filteredChats(sessions: SessionMetadata[]): SessionMetadata[] {
    const term = this.search?.toLowerCase().trim();

    const filtered = term
      ? sessions.filter((session) => session.name.toLowerCase().includes(term))
      : sessions;

    const limit = this.sessionsDisplayLimit();

    if (filtered.length < limit && sessions.length < (this.sessionStore.getTotalSessions(true) || 0)) {
      void this.sessionStore.refreshSessions(true, sessions.length, 12, true);
    }

    return filtered.slice(0, limit);
  }

  filteredWriteUps(writeUps: WriteUpMetadata[]): WriteUpMetadata[] {
    const term = this.search?.toLowerCase().trim();

    const filtered = term
      ? writeUps.filter((writeUp) => writeUp.name.toLowerCase().includes(term))
      : writeUps;

    const limit = this.writeUpsDisplayLimit();

    if (filtered.length < limit && writeUps.length < (this.writeUpStore.getTotalWriteUps(true) || 0)) {
      void this.writeUpStore.refreshAllWriteUps(writeUps.length, 12, true);
    }

    return filtered.slice(0, limit);
  }
}
