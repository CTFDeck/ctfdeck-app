import { Injectable, OnDestroy, inject } from '@angular/core';
import { BehaviorSubject, Observable, Subscription, combineLatest, map } from 'rxjs';
import { toast } from 'ngx-sonner';
import { WebSocketService } from '../../../infrastructure/transport/websocket/websocket.service';
import { SessionStore } from '../../sessions/state/session.store';
import { WriteUpStore } from '../../writeups/state/writeup.store';
import { ProjectHierarchy, FolderHierarchy } from '../models/project-hierarchy.model';
import { ProjectData, ProjectMetadata } from '../models/project.model';
import { ProjectClientService } from '../infrastructure/project-client.service';

@Injectable({ providedIn: 'root' })
export class ProjectStore implements OnDestroy {
  private projectClient = inject(ProjectClientService);
  private sessionStore = inject(SessionStore);
  private writeUpStore = inject(WriteUpStore);
  private ws = inject(WebSocketService);

  private projectsSubject = new BehaviorSubject<ProjectMetadata[]>([]);
  readonly projects$ = this.projectsSubject.asObservable();

  private loadingSubject = new BehaviorSubject<boolean>(false);

  private totalProjectsCountSubject = new BehaviorSubject<number>(0);
  readonly totalProjectsCount$ = this.totalProjectsCountSubject.asObservable();

  private projectDataCacheSubject = new BehaviorSubject<Map<string, ProjectData>>(new Map());
  readonly projectDataCache$ = this.projectDataCacheSubject.asObservable();

  private subscriptions = new Subscription();

  constructor() {
    this.subscriptions.add(
      this.ws.isConnected$.subscribe((connected) => {
        if (connected) {
          this.loadProjects().then();
          return;
        }

        this.projectsSubject.next([]);
        this.projectDataCacheSubject.next(new Map());
      }),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  async loadProjects(offset = 0, limit = 6): Promise<void> {
    this.loadingSubject.next(true);

    try {
      const result = await this.projectClient.list(offset, limit);
      this.totalProjectsCountSubject.next(result.totalCount);

      if (offset === 0) {
        this.projectsSubject.next(result.projects);
        return;
      }

      this.projectsSubject.next([...this.projectsSubject.value, ...result.projects]);
    } catch (error) {
      console.error('[ProjectStore] Failed to load projects list:', error);
    } finally {
      this.loadingSubject.next(false);
    }
  }

  async loadProjectDetails(projectId: string): Promise<void> {
    try {
      const result = await this.projectClient.load(projectId);

      if (!result.success || !result.project) {
        return;
      }

      const nextCache = new Map(this.projectDataCacheSubject.value);
      nextCache.set(projectId, result.project);
      this.projectDataCacheSubject.next(nextCache);
    } catch (error) {
      console.error(`[ProjectStore] Failed to load project details for ${projectId}:`, error);
    }
  }

  getHierarchy$(): Observable<ProjectHierarchy[]> {
    return combineLatest([
      this.projects$,
      this.projectDataCache$,
      this.sessionStore.sessions$,
      this.writeUpStore.allWriteUps$,
    ]).pipe(
      map(([projects, projectDataCache, allSessions, allWriteups]) => {
        return projects.map((project): ProjectHierarchy => {
          const cachedProject = projectDataCache.get(project.id);
          const flatFolders = cachedProject?.folders || [];

          const folderMap = new Map<string, FolderHierarchy>();
          const roots: FolderHierarchy[] = [];

          flatFolders.forEach((folder) => {
            folderMap.set(folder.id, {
              id: folder.id,
              name: folder.name,
              isSystem: folder.isSystem,
              sessions: allSessions.filter((session) => session.folderId === folder.id),
              writeups: allWriteups.filter((writeup) => writeup.folderId === folder.id),
              folders: [],
            });
          });

          flatFolders.forEach((folder) => {
            const currentFolder = folderMap.get(folder.id)!;

            if (folder.parentId && folderMap.has(folder.parentId)) {
              folderMap.get(folder.parentId)!.folders.push(currentFolder);
              return;
            }

            roots.push(currentFolder);
          });

          const rootSessions = allSessions.filter(
            (session) => session.projectId === project.id && !session.folderId,
          );
          const rootWriteups = allWriteups.filter(
            (writeup) => writeup.projectId === project.id && !writeup.folderId,
          );

          if (rootSessions.length > 0 || rootWriteups.length > 0) {
            roots.unshift({
              id: `root-${project.id}`,
              name: 'Root Items',
              isSystem: true,
              sessions: rootSessions,
              writeups: rootWriteups,
              folders: [],
            });
          }

          return {
            id: project.id,
            name: project.name,
            description: project.description,
            folders: roots,
          };
        });
      }),
    );
  }

  async createProject(
    name: string,
    description = '',
  ): Promise<{ success: boolean; projectId: string }> {
    try {
      const result = await this.projectClient.create(name, description);

      if (result.success) {
        toast.success('Project created', { description: `Project "${name}" is ready.` });
        await this.loadProjects();
      } else {
        toast.error('Failed to create project');
      }

      return result;
    } catch (error) {
      this.showError('Project creation failed', error);
      return { success: false, projectId: '' };
    }
  }

  async addFolder(
    projectId: string,
    name: string,
    parentId: string | null = null,
  ): Promise<{ success: boolean; folderId: string }> {
    try {
      const result = await this.projectClient.addFolder(projectId, name, parentId);

      if (result.success) {
        toast.success('Folder added', { description: `Folder "${name}" was created.` });
        await this.loadProjectDetails(projectId);
      } else {
        toast.error('Failed to add folder');
      }

      return result;
    } catch (error) {
      this.showError('Failed to add folder', error);
      return { success: false, folderId: '' };
    }
  }

  async renameFolder(projectId: string, folderId: string, name: string): Promise<boolean> {
    try {
      const result = await this.projectClient.renameFolder(projectId, folderId, name);

      if (result) {
        toast.success('Folder renamed');
        await this.loadProjectDetails(projectId);
      } else {
        toast.error('Failed to rename folder');
      }

      return result;
    } catch (error) {
      this.showError('Failed to rename folder', error);
      return false;
    }
  }

  async updateProject(projectId: string, name: string, description: string): Promise<boolean> {
    try {
      const result = await this.projectClient.update(projectId, name, description);

      if (result) {
        toast.success('Project updated');
        await this.loadProjects();
        await this.loadProjectDetails(projectId);
      } else {
        toast.error('Failed to update project');
      }

      return result;
    } catch (error) {
      this.showError('Failed to update project', error);
      return false;
    }
  }

  async deleteProject(projectId: string): Promise<boolean> {
    try {
      const result = await this.projectClient.delete(projectId);

      if (result) {
        toast.success('Project deleted');
        await this.loadProjects();
        const nextCache = new Map(this.projectDataCacheSubject.value);
        nextCache.delete(projectId);
        this.projectDataCacheSubject.next(nextCache);
      } else {
        toast.error('Failed to delete project');
      }

      return result;
    } catch (error) {
      this.showError('Failed to delete project', error);
      return false;
    }
  }

  async deleteFolder(projectId: string, folderId: string): Promise<boolean> {
    try {
      const result = await this.projectClient.deleteFolder(projectId, folderId);

      if (result) {
        toast.success('Folder deleted');
        await this.loadProjectDetails(projectId);
      } else {
        toast.error('Failed to delete folder');
      }

      return result;
    } catch (error) {
      this.showError('Failed to delete folder', error);
      return false;
    }
  }

  async assignSession(
    projectId: string,
    sessionId: string,
    folderId: string | null,
  ): Promise<boolean> {
    try {
      const result = await this.projectClient.assignSession(projectId, sessionId, folderId);

      if (result) {
        toast.success('Item moved');
        await this.loadProjectDetails(projectId);
        await Promise.all([
          this.sessionStore.refreshSessions(true, 0, 12, true),
          this.sessionStore.refreshSessions(true, 0, 50, false),
        ]);
      } else {
        toast.error('Failed to move item');
      }

      return result;
    } catch (error) {
      this.showError('Failed to move item', error);
      return false;
    }
  }

  async exportProject(
    projectId: string,
    path: string,
    options: {
      history: boolean;
      targets: boolean;
      writeups: boolean;
      media: boolean;
      scripts: boolean;
    },
  ): Promise<boolean> {
    try {
      const success = await this.projectClient.export(projectId, path, options);

      if (success) {
        toast.success('Project exported', { description: `Saved to ${path}` });
      } else {
        toast.error('Export failed');
      }

      return success;
    } catch (error) {
      this.showError('Export failed', error);
      return false;
    }
  }

  async importProject(path: string): Promise<boolean> {
    try {
      const result = await this.projectClient.importProject(path);

      if (result.success) {
        toast.success('Project imported');
        await this.loadProjects();
      } else {
        toast.error('Import failed');
      }

      return result.success;
    } catch (error) {
      this.showError('Import failed', error);
      return false;
    }
  }

  private showError(title: string, error: unknown): void {
    toast.error(title, {
      description:
        error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown error',
    });
  }
}
