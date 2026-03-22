import { CdkScrollable } from '@angular/cdk/scrolling';
import { Overlay } from '@angular/cdk/overlay';
import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostBinding, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { toast } from 'ngx-sonner';
import { BRN_TOOLTIP_SCROLL_STRATEGY } from '@spartan-ng/brain/tooltip';
import { BrnDialogContent, BrnDialogImports, BrnDialogTrigger } from '@spartan-ng/brain/dialog';
import { HlmButtonImports } from '@ctfdeck/helm/button';
import { HlmDialogImports } from '@ctfdeck/helm/dialog';
import { HlmInputGroupImports } from '@ctfdeck/helm/input-group';
import { HlmInputImports } from '@ctfdeck/helm/input';
import { HlmLabelImports } from '@ctfdeck/helm/label';
import { HlmScrollAreaImports } from '@ctfdeck/helm/scroll-area';
import { HlmSidebarImports } from '@ctfdeck/helm/sidebar';
import { HlmTooltipImports } from '@ctfdeck/helm/tooltip';
import { HlmMenuImports } from '@ctfdeck/helm/menu';
import { HlmCheckboxImports } from '@ctfdeck/helm/checkbox';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { SidebarRecentListComponent } from './components/recent-list/sidebar-recent-list.component';
import { SidebarProjectListComponent } from './components/project-list/sidebar-project-list.component';
import {
  lucideArrowUp,
  lucideCheck,
  lucideChevronDown,
  lucideChevronRight,
  lucideChevronUp,
  lucideDownload,
  lucideFilePlus,
  lucideLayoutGrid,
  lucideMessageCircleDashed,
  lucideMessageSquarePlus,
  lucidePanelLeft,
  lucidePlus,
  lucideSearch,
  lucideUpload,
} from '@ng-icons/lucide';
import { Observable, map } from 'rxjs';
import { ProjectExportMetadata } from '../../domains/projects/infrastructure/project.websocket.protocol';
import { ProjectStore } from '../../domains/projects/state/project.store';
import { HlmTableImports } from '@ctfdeck/helm/table';
import { SessionMetadata } from '../../domains/sessions/models/session-metadata.model';
import { SessionStore } from '../../domains/sessions/state/session.store';
import { WriteUpMetadata } from '../../domains/writeups/models/writeup.model';
import { WriteUpStore } from '../../domains/writeups/state/writeup.store';
import { DEFAULT_CHAT_NAME, DEFAULT_WRITEUP_NAME } from '../../shared/constants/default-item-names.constants';
import { TranslatePipe } from '../menubar/translate.pipe';

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
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
    ...HlmMenuImports,
    ...HlmCheckboxImports,
    ...HlmTableImports,
    CdkScrollable,
    BrnDialogContent,
    BrnDialogTrigger,
    SidebarRecentListComponent,
    SidebarProjectListComponent,
    TranslatePipe,
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
      lucideLayoutGrid,
      lucideMessageSquarePlus,
      lucideChevronUp,
      lucideChevronDown,
      lucideChevronRight,
      lucideFilePlus,
      lucideDownload,
      lucideUpload,
    }),
  ],
  templateUrl: './workspace-sidebar.component.html',
  styleUrls: ['./workspace-sidebar.component.css'],
})
export class WorkspaceSidebarComponent {
  private sessionStore = inject(SessionStore);
  private writeUpStore = inject(WriteUpStore);
  private router = inject(Router);
  private readonly FILENAME_SANITIZATION_REGEX = /[^a-zA-Z0-9\-_]/g;

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
  
  sessions$: Observable<SessionMetadata[]>;
  activeSessionId$: Observable<string | null>;
  sessionsLoading$: Observable<boolean>;

  writeUps$: Observable<WriteUpMetadata[]>;
  writeUpsLoading$: Observable<boolean>;
  activeWriteUpId$: Observable<string | null>;

  totalProjectsCount$: Observable<number>;
  totalSessions$: Observable<number>;
  totalWriteUps$: Observable<number>;
  availableExports$: Observable<ProjectExportMetadata[]>;
  selectedExportPaths = new Set<string>();

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
  @ViewChild('exportProjectTrigger') exportProjectTrigger!: ElementRef<HTMLButtonElement>;
  @ViewChild('importProjectTrigger') importProjectTrigger!: ElementRef<HTMLButtonElement>;

  createProjectDraft = { name: '', description: '' };
  createFolderDraft = { projectId: '', parentId: null as string | null, name: '' };
  folderToRenameDraft = { projectId: '', folderId: '', name: '', description: '' };
  folderToDeleteDraft = { projectId: '', folderId: '', name: '' };
  newItemDraft = { name: '', type: 'session' as 'session' | 'writeup' };
  exportDraft = {
    projectId: '',
    filename: '',
    options: { history: true, targets: true, writeups: true, media: true, scripts: true },
  };
  importDraft = { path: '' };
  successfullyDroppedId = signal<string | null>(null);
  isDragging = signal(false);
  isScrolling = signal(false);

  @ViewChild('scrollContainer', { read: ElementRef }) scrollContainer!: ElementRef;
  
  private scrollTimeout: ReturnType<typeof setTimeout> | null = null;
  private dragScrollInterval: ReturnType<typeof setInterval> | null = null;
  
  protected readonly projectStore = inject(ProjectStore);

  constructor() {
    this.sessions$ = this.sessionStore.unassignedSessions$;
    this.activeSessionId$ = this.sessionStore.activeSessionId$;
    this.sessionsLoading$ = this.sessionStore.sessionsLoading$;

    this.writeUps$ = this.writeUpStore.unassignedWriteUps$;
    this.writeUpsLoading$ = this.writeUpStore.writeUpsLoading$;
    this.totalProjectsCount$ = this.projectStore.totalProjectsCount$;
    this.totalSessions$ = this.sessionStore.unassignedTotal$;
    this.totalWriteUps$ = this.writeUpStore.unassignedTotal$;
    this.availableExports$ = this.projectStore.availableExports$;
    this.activeWriteUpId$ = new Observable((subscriber) => {
      this.writeUpStore.activeWriteUp$.subscribe((activeWriteUp) =>
        subscriber.next(activeWriteUp?.id || null),
      );
    });
  }

  get groupedExports$() {
    return this.availableExports$.pipe(
      map((exports: ProjectExportMetadata[]) => ({
        new: exports.filter((e) => !e.isAlreadyImported),
        imported: exports.filter((e) => e.isAlreadyImported),
      })),
    );
  }

  showImported = signal(false);

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

  openExportDialog(projectId: string, name: string): void {
    this.exportDraft = {
      projectId,
      filename: `${name.replace(this.FILENAME_SANITIZATION_REGEX, '_')}_export`,
      options: { history: true, targets: true, writeups: true, media: true, scripts: true },
    };
    setTimeout(() => this.exportProjectTrigger.nativeElement.click());
  }

  async confirmExport(ctx: { close: () => void }): Promise<void> {
    const { projectId, filename, options } = this.exportDraft;
    const sanitizedName = filename.trim().replace(this.FILENAME_SANITIZATION_REGEX, '_');
    if (!sanitizedName) {
      toast.warning('Export filename required');
      return;
    }

    ctx.close();
    try {
      await this.projectStore.exportProject(projectId, `${sanitizedName}.json`, options);
    } catch (error) {
      console.error('[WorkspaceSidebar] Export failed:', error);
    }
  }

  openImportDialog(): void {
    this.selectedExportPaths.clear();
    void this.projectStore.loadAvailableExports();
    setTimeout(() => this.importProjectTrigger.nativeElement.click());
  }

  async confirmImport(ctx: { close: () => void }): Promise<void> {
    const paths = Array.from(this.selectedExportPaths);
    if (paths.length === 0) {
      toast.warning('Import selection required');
      return;
    }

    ctx.close();
    await this.projectStore.importProjects(paths);
  }

  toggleExportSelection(path: string): void {
    if (this.selectedExportPaths.has(path)) {
      this.selectedExportPaths.delete(path);
    } else {
      this.selectedExportPaths.add(path);
    }
  }

  toggleAllExports(exports: ProjectExportMetadata[]): void {
    const allSelected = exports.every((e) => this.selectedExportPaths.has(e.filename));
    if (allSelected) {
      exports.forEach((e) => this.selectedExportPaths.delete(e.filename));
    } else {
      exports.forEach((e) => this.selectedExportPaths.add(e.filename));
    }
  }

  areAllSelected(exports: ProjectExportMetadata[]): boolean {
    return exports.length > 0 && exports.every((e) => this.selectedExportPaths.has(e.filename));
  }

  formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
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
    const defaultName = this.newItemDraft.type === 'session' ? DEFAULT_CHAT_NAME : DEFAULT_WRITEUP_NAME;
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

  toggleSidebar(): void {
    this.isCollapsed.set(!this.isCollapsed());
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
      // Parent folder expansion should be handled via project list component if needed
    }
  }

  openRenameFolderDialog(projectId: string, folderId: string, currentName: string, description = ''): void {
    this.folderToRenameDraft = { projectId, folderId, name: currentName, description };
    setTimeout(() => this.renameFolderTrigger.nativeElement.click());
  }

  async renameFolder(ctx: { close: () => void }): Promise<void> {
    const { projectId, folderId, name, description } = this.folderToRenameDraft;
    const trimmedName = name.trim();
    if (!trimmedName) {
      return;
    }

    ctx.close();
    if (folderId) {
      await this.projectStore.renameFolder(projectId, folderId, trimmedName);
    } else {
      await this.projectStore.updateProject(projectId, trimmedName, description);
    }
  }

  openDeleteFolderDialog(projectId: string, folderId: string, name: string): void {
    this.folderToDeleteDraft = { projectId, folderId, name };
    setTimeout(() => this.deleteFolderTrigger.nativeElement.click());
  }

  async deleteFolder(ctx: { close: () => void }): Promise<void> {
    const { projectId, folderId } = this.folderToDeleteDraft;
    ctx.close();
    if (folderId) {
      await this.projectStore.deleteFolder(projectId, folderId);
    } else {
      await this.projectStore.deleteProject(projectId);
    }
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
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    this.isScrolling.set(true);
    this.handleDragScroll(event);
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

  onFolderDragOver(event: DragEvent, id: string, type: 'project' | 'folder' = 'folder'): void {
    event.preventDefault();
    this.handleDragScroll(event);
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

    if (
      fromBottom < threshold &&
      container.scrollTop + container.clientHeight < container.scrollHeight
    ) {
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

    const type = event.dataTransfer?.getData('application/ctf-type') as
      | 'session'
      | 'writeup'
      | null;
    const id = event.dataTransfer?.getData('application/ctf-id');

    if (!type || !id) {
      return;
    }

    if (id === folderId) {
      return;
    }

    try {
      let success;

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
}
