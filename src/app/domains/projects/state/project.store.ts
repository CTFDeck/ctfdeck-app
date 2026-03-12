import { Injectable, OnDestroy, inject } from '@angular/core';
import { BehaviorSubject, Observable, Subscription, combineLatest, map } from 'rxjs';
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
    const result = await this.projectClient.create(name, description);

    if (result.success) {
      await this.loadProjects();
    }

    return result;
  }

  async addFolder(
    projectId: string,
    name: string,
    parentId: string | null = null,
  ): Promise<{ success: boolean; folderId: string }> {
    const result = await this.projectClient.addFolder(projectId, name, parentId);

    if (result.success) {
      await this.loadProjectDetails(projectId);
    }

    return result;
  }

  async renameFolder(projectId: string, folderId: string, name: string): Promise<boolean> {
    const result = await this.projectClient.renameFolder(projectId, folderId, name);

    if (result) {
      await this.loadProjectDetails(projectId);
    }

    return result;
  }

  async deleteFolder(projectId: string, folderId: string): Promise<boolean> {
    const result = await this.projectClient.deleteFolder(projectId, folderId);

    if (result) {
      await this.loadProjectDetails(projectId);
    }

    return result;
  }

  async assignSession(
    projectId: string,
    sessionId: string,
    folderId: string | null,
  ): Promise<boolean> {
    const result = await this.projectClient.assignSession(projectId, sessionId, folderId);

    if (result) {
      await this.loadProjectDetails(projectId);
      await Promise.all([
        this.sessionStore.refreshSessions(true, 0, 12, true),
        this.sessionStore.refreshSessions(true, 0, 50, false),
      ]);
    }

    return result;
  }
}
