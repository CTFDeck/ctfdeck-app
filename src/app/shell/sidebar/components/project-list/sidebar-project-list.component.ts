import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideChevronDown,
  lucideChevronRight,
  lucideFolder,
  lucideFolderOpen,
  lucideFolderPlus,
  lucideLayoutGrid,
  lucideDownload,
  lucidePencil,
  lucideTrash2,
  lucideMessageCircleDashed,
  lucideFileText,
} from '@ng-icons/lucide';
import { HlmTooltipImports } from '@ctfdeck/helm/tooltip';
import { Observable, firstValueFrom } from 'rxjs';
import { ProjectHierarchy } from '../../../../domains/projects/models/project-hierarchy.model';
import { ProjectStore } from '../../../../domains/projects/state/project.store';
import { TranslatePipe } from '../../../menubar/translate.pipe';

@Component({
  selector: 'ctf-sidebar-project-list',
  standalone: true,
  imports: [CommonModule, NgIcon, HlmTooltipImports, TranslatePipe],
  providers: [
    provideIcons({
      lucideChevronDown,
      lucideChevronRight,
      lucideLayoutGrid,
      lucideFolderPlus,
      lucideFolderOpen,
      lucideFolder,
      lucideDownload,
      lucidePencil,
      lucideTrash2,
      lucideMessageCircleDashed,
      lucideFileText,
    }),
  ],
  templateUrl: './sidebar-project-list.component.html',
  styleUrls: ['./sidebar-project-list.component.css'],
})
export class SidebarProjectListComponent {
  @Input() isCollapsed = false;
  @Input() successfullyDroppedId: string | null = null;
  @Input() activeSessionId: string | null = null;
  @Input() activeWriteUpId: string | null = null;

  @Output() openCreateFolder = new EventEmitter<{ projectId: string; parentId: string | null }>();
  @Output() openExportProject = new EventEmitter<{ projectId: string; name: string }>();
  @Output() openRenameFolder = new EventEmitter<{ projectId: string; folderId: string; name: string; description?: string }>();
  @Output() openDeleteFolder = new EventEmitter<{ projectId: string; folderId: string; name: string }>();
  @Output() openChat = new EventEmitter<any>();
  @Output() openWriteUp = new EventEmitter<any>();
  @Output() openRenameChat = new EventEmitter<any>();
  @Output() openDeleteChat = new EventEmitter<any>();
  @Output() openRenameWriteUp = new EventEmitter<any>();
  @Output() openDeleteWriteUp = new EventEmitter<any>();
  
  @Output() dragStarted = new EventEmitter<{ event: DragEvent; type: 'session' | 'writeup'; id: string }>();
  @Output() dragEnded = new EventEmitter<void>();
  @Output() folderDragOver = new EventEmitter<{ event: DragEvent; id: string; type: 'project' | 'folder' }>();
  @Output() folderDragLeave = new EventEmitter<DragEvent>();
  @Output() itemDropped = new EventEmitter<{ event: DragEvent; projectId: string; folderId: string | null }>();

  protected readonly projectStore = inject(ProjectStore);
  
  hierarchy$: Observable<ProjectHierarchy[]>;
  totalProjectsCount$: Observable<number>;
  
  expandedProjectIds = signal<Set<string>>(new Set());
  expandedFolderIds = signal<Set<string>>(new Set());
  hoveredFolderId = signal<string | null>(null);

  private folderExpandTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.hierarchy$ = this.projectStore.getHierarchy$();
    this.totalProjectsCount$ = this.projectStore.totalProjectsCount$;
  }

  toggleProject(projectId: string): void {
    const next = new Set(this.expandedProjectIds());
    if (next.has(projectId)) {
      next.delete(projectId);
    } else {
      next.add(projectId);
      void this.projectStore.loadProjectDetails(projectId);
    }
    this.expandedProjectIds.set(next);
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

  async loadMoreProjects(): Promise<void> {
    const projects = await firstValueFrom(this.projectStore.projects$);
    await this.projectStore.loadProjects(projects.length, 6);
  }

  onDragStart(event: DragEvent, type: 'session' | 'writeup', id: string): void {
    this.dragStarted.emit({ event, type, id });
  }

  onDragEnd(): void {
    this.dragEnded.emit();
  }

  onFolderDragOver(event: DragEvent, id: string, type: 'project' | 'folder' = 'folder'): void {
    event.preventDefault();
    this.folderDragOver.emit({ event, id, type });

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
            this.toggleProject(id);
          } else {
            this.toggleFolder(id);
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
    this.folderDragLeave.emit(event);
  }

  private clearFolderExpandTimer(): void {
    if (this.folderExpandTimeout) {
      clearTimeout(this.folderExpandTimeout);
      this.folderExpandTimeout = null;
    }
    this.hoveredFolderId.set(null);
  }

  onDrop(event: DragEvent, projectId: string, folderId: string | null): void {
    this.itemDropped.emit({ event, projectId, folderId });
  }
}
