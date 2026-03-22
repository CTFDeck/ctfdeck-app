import { Injectable, inject, signal } from '@angular/core';
import { toast } from 'ngx-sonner';
import { Observable, firstValueFrom, map } from 'rxjs';
import { ProjectMetadata } from '../../../../domains/projects/models/project.model';
import { ProjectExportMetadata } from '../../../../domains/projects/infrastructure/project.websocket.protocol';
import { ProjectStore } from '../../../../domains/projects/state/project.store';

export type ProjectsDialogType = 'new' | 'import' | 'export';
export type ExportDialogMode = 'single' | 'global';

@Injectable({ providedIn: 'root' })
export class ProjectsUiService {
  private readonly projectStore = inject(ProjectStore);
  private readonly FILENAME_SANITIZATION_REGEX = /[^a-zA-Z0-9\-_]/g;

  readonly activeDialog = signal<ProjectsDialogType | null>(null);
  readonly exportDialogMode = signal<ExportDialogMode>('global');
  readonly singleExportProjectName = signal('');

  readonly createProjectDraft = signal({ name: '', description: '' });
  readonly importSelection = signal<Set<string>>(new Set());
  readonly exportSelection = signal<Set<string>>(new Set());
  readonly exportDraft = signal({
    projectId: '',
    filename: '',
    options: { history: true, targets: true, writeups: true, media: true, scripts: true },
  });
  readonly globalExportDraft = signal({
    suffix: 'export',
    options: { history: true, targets: true, writeups: true, media: true, scripts: true },
  });

  readonly availableExports$ = this.projectStore.availableExports$;
  readonly groupedExports$ = this.availableExports$.pipe(
    map((exports: ProjectExportMetadata[]) => ({
      fresh: exports.filter((entry) => !entry.isAlreadyImported),
      imported: exports.filter((entry) => entry.isAlreadyImported),
    })),
  );
  readonly sortedProjectsForExport$ = this.projectStore.projects$.pipe(
    map((projects) => [...projects].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())),
  );

  openNewProject(): void {
    this.createProjectDraft.set({ name: 'New Project', description: '' });
    this.activeDialog.set(null);
    this.activeDialog.set('new');
  }

  openImportProjects(): void {
    this.importSelection.set(new Set());
    void this.projectStore.loadAvailableExports();
    this.activeDialog.set(null);
    this.activeDialog.set('import');
  }

  openExportProjects(): void {
    this.exportDialogMode.set('global');
    this.exportSelection.set(new Set());
    this.globalExportDraft.set({
      suffix: 'export',
      options: { history: true, targets: true, writeups: true, media: true, scripts: true },
    });

    void this.loadAllProjectsForExport();
    this.activeDialog.set(null);
    this.activeDialog.set('export');
  }

  openExportProject(projectId: string, projectName: string): void {
    this.exportDialogMode.set('single');
    this.singleExportProjectName.set(projectName);
    this.exportDraft.set({
      projectId,
      filename: `${projectName.replace(this.FILENAME_SANITIZATION_REGEX, '_')}_export`,
      options: { history: true, targets: true, writeups: true, media: true, scripts: true },
    });
    this.activeDialog.set(null);
    this.activeDialog.set('export');
  }

  closeDialog(): void {
    this.activeDialog.set(null);
  }

  updateCreateProjectDraft(next: { name: string; description: string }): void {
    this.createProjectDraft.set(next);
  }

  async createProject(): Promise<void> {
    const draft = this.createProjectDraft();
    const name = draft.name.trim();
    if (!name) {
      return;
    }

    await this.projectStore.createProject(name, draft.description);
  }

  toggleImportSelection(path: string): void {
    const next = new Set(this.importSelection());
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    this.importSelection.set(next);
  }

  toggleAllImports(exports: ProjectExportMetadata[]): void {
    const next = new Set(this.importSelection());
    const allSelected = exports.length > 0 && exports.every((entry) => next.has(entry.filename));

    if (allSelected) {
      exports.forEach((entry) => next.delete(entry.filename));
    } else {
      exports.forEach((entry) => next.add(entry.filename));
    }

    this.importSelection.set(next);
  }

  areAllImportsSelected(exports: ProjectExportMetadata[]): boolean {
    const current = this.importSelection();
    return exports.length > 0 && exports.every((entry) => current.has(entry.filename));
  }

  async confirmImport(): Promise<void> {
    const paths = Array.from(this.importSelection());
    if (paths.length === 0) {
      toast.warning('Import selection required');
      return;
    }

    await this.projectStore.importProjects(paths);
  }

  updateExportDraft(next: {
    projectId: string;
    filename: string;
    options: { history: boolean; targets: boolean; writeups: boolean; media: boolean; scripts: boolean };
  }): void {
    this.exportDraft.set(next);
  }

  async confirmSingleExport(): Promise<void> {
    const draft = this.exportDraft();
    const sanitizedName = draft.filename.trim().replace(this.FILENAME_SANITIZATION_REGEX, '_');

    if (!sanitizedName) {
      toast.warning('Export filename required');
      return;
    }

    try {
      await this.projectStore.exportProject(draft.projectId, `${sanitizedName}.json`, draft.options);
    } catch (error) {
      console.error('[ProjectsUiService] Export failed:', error);
    }
  }

  updateGlobalExportDraft(next: {
    suffix: string;
    options: { history: boolean; targets: boolean; writeups: boolean; media: boolean; scripts: boolean };
  }): void {
    this.globalExportDraft.set(next);
  }

  toggleProjectSelection(projectId: string): void {
    const next = new Set(this.exportSelection());
    if (next.has(projectId)) {
      next.delete(projectId);
    } else {
      next.add(projectId);
    }
    this.exportSelection.set(next);
  }

  toggleAllProjectSelections(projectIds: string[]): void {
    const next = new Set(this.exportSelection());
    const allSelected = projectIds.length > 0 && projectIds.every((id) => next.has(id));

    if (allSelected) {
      projectIds.forEach((id) => next.delete(id));
    } else {
      projectIds.forEach((id) => next.add(id));
    }

    this.exportSelection.set(next);
  }

  areAllProjectSelectionsSelected(projectIds: string[]): boolean {
    const current = this.exportSelection();
    return projectIds.length > 0 && projectIds.every((id) => current.has(id));
  }

  projectIds(projects: ProjectMetadata[]): string[] {
    return projects.map((project) => project.id);
  }

  async confirmGlobalExport(): Promise<void> {
    const selectedIds = this.exportSelection();
    if (selectedIds.size === 0) {
      toast.warning('Export selection required');
      return;
    }

    const projects = await firstValueFrom(this.projectStore.projects$);
    const selectedProjects = projects.filter((project) => selectedIds.has(project.id));

    if (selectedProjects.length === 0) {
      toast.warning('No selected projects found');
      return;
    }

    const draft = this.globalExportDraft();
    const suffix = draft.suffix.trim().replace(this.FILENAME_SANITIZATION_REGEX, '_');
    const usedNames = new Map<string, number>();
    let successCount = 0;

    for (const project of selectedProjects) {
      const baseName = project.name.trim().replace(this.FILENAME_SANITIZATION_REGEX, '_') || 'project';
      const filenameBase = suffix ? `${baseName}_${suffix}` : baseName;
      const duplicateIndex = (usedNames.get(filenameBase) ?? 0) + 1;
      usedNames.set(filenameBase, duplicateIndex);
      const uniqueFilenameBase = duplicateIndex > 1 ? `${filenameBase}_${duplicateIndex}` : filenameBase;

      const success = await this.projectStore.exportProject(
        project.id,
        `${uniqueFilenameBase}.json`,
        draft.options,
        true,
      );

      if (success) {
        successCount += 1;
      }
    }

    if (successCount === selectedProjects.length) {
      toast.success(
        successCount > 1 ? `Successfully exported ${successCount} projects` : 'Project exported',
      );
      return;
    }

    if (successCount === 0) {
      toast.error('Export failed for all selected projects');
      return;
    }

    toast.warning(`Export completed with partial success (${successCount}/${selectedProjects.length})`);
  }

  formatSize(bytes: number): string {
    if (bytes === 0) {
      return '0 B';
    }

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  private async loadAllProjectsForExport(): Promise<void> {
    await this.projectStore.loadProjects(0, 50);

    let projects = await firstValueFrom(this.projectStore.projects$);
    let total = await firstValueFrom(this.projectStore.totalProjectsCount$);

    while (projects.length < total) {
      await this.projectStore.loadProjects(projects.length, 50);
      projects = await firstValueFrom(this.projectStore.projects$);
      total = await firstValueFrom(this.projectStore.totalProjectsCount$);
    }
  }
}
