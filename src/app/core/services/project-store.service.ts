import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, combineLatest, map, Observable, Subscription } from 'rxjs';
import { ProjectService } from './project.service';
import { ProjectMetadata, ProjectFolderMetadata, ProjectData } from './project.protocol';
import { SessionStoreService } from './session-store.service';
import { SessionMetadata } from './session.protocol';
import { WriteUpStoreService } from './writeup-store.service';
import { WriteUpMetadata } from './writeup.protocol';
import { WebSocketService } from './websocket.service';

export interface ProjectHierarchy {
  id: string;
  name: string;
  description: string;
  folders: FolderHierarchy[];
}

export interface FolderHierarchy {
  id: string;
  name: string;
  isSystem: boolean;
  sessions: any[];
  writeups: any[];
  folders: FolderHierarchy[]; // Recursive subfolders
}

@Injectable({ providedIn: 'root' })
export class ProjectStoreService implements OnDestroy {
  private _projects = new BehaviorSubject<ProjectMetadata[]>([]);
  public projects$ = this._projects.asObservable();

  private _loading = new BehaviorSubject<boolean>(false);
  public loading$ = this._loading.asObservable();

  // Cache ProjectData by ID to support multiple expanded projects
  private _projectDataCache = new BehaviorSubject<Map<string, ProjectData>>(new Map());
  public projectDataCache$ = this._projectDataCache.asObservable();

  private _subscriptions = new Subscription();

  constructor(
    private projectService: ProjectService,
    private sessionStore: SessionStoreService,
    private writeupStore: WriteUpStoreService,
    private ws: WebSocketService,
  ) {
    this._subscriptions.add(
      this.ws.isConnected$.subscribe((connected) => {
        if (connected) {
          this.loadProjects();
        } else {
          this._projects.next([]);
          this._projectDataCache.next(new Map());
        }
      }),
    );
  }

  ngOnDestroy() {
    this._subscriptions.unsubscribe();
  }

  async loadProjects() {
    this._loading.next(true);
    try {
      const projects = await this.projectService.list();
      this._projects.next(projects);
    } catch (e) {
      console.error('[ProjectStore] Failed to load projects list:', e);
    } finally {
      this._loading.next(false);
    }
  }

  /**
   * Loads full project data (including folders) into the cache.
   */
  async loadProjectDetails(projectId: string) {
    try {
      const res = await this.projectService.load(projectId);
      if (res.success && res.project) {
        const cache = this._projectDataCache.value;
        cache.set(projectId, res.project);
        this._projectDataCache.next(new Map(cache));
      }
    } catch (e) {
      console.error(`[ProjectStore] Failed to load project details for ${projectId}:`, e);
    }
  }

  /**
   * Returns an observable of the projects hierarchy.
   * Recursive folders are supported.
   */
  getHierarchy$(): Observable<ProjectHierarchy[]> {
    return combineLatest([
      this.projects$,
      this.projectDataCache$,
      this.sessionStore.sessions$,
      this.writeupStore.writeUps$,
    ]).pipe(
      map(([projects, dataCache, allSessions, allWriteups]): ProjectHierarchy[] => {
        return projects.map((p) => {
          const cached = dataCache.get(p.id);
          const flatFolders = cached?.folders || [];
          
          // Build tree from flat list
          const folderMap = new Map<string, FolderHierarchy>();
          const roots: FolderHierarchy[] = [];

          // 1. Create all folder objects
          flatFolders.forEach(f => {
            folderMap.set(f.id, {
               id: f.id,
               name: f.name,
               isSystem: f.isSystem,
               sessions: allSessions.filter(s => s.folderId === f.id),
               writeups: allWriteups.filter(w => w.folderId === f.id),
               folders: []
            });
          });

          // 2. Build tree
          flatFolders.forEach(f => {
            const folder = folderMap.get(f.id)!;
            if (f.parentId && folderMap.has(f.parentId)) {
              folderMap.get(f.parentId)!.folders.push(folder);
            } else {
              roots.push(folder);
            }
          });

          // Handle sessions in project root (no folder)
          const rootSessions = allSessions.filter(s => s.projectId === p.id && !s.folderId);
          if (rootSessions.length > 0) {
              roots.unshift({
                  id: `root-${p.id}`,
                  name: 'Root Items',
                  isSystem: true,
                  sessions: rootSessions,
                  writeups: [],
                  folders: []
              });
          }

          return {
            id: p.id,
            name: p.name,
            description: p.description,
            folders: roots,
          };
        });
      }),
    );
  }

  async createProject(name: string, description = '') {
    const res = await this.projectService.create(name, description);
    if (res.success) {
      this.loadProjects();
    }
    return res;
  }

  async addFolder(projectId: string, name: string, parentIdReq: string | null = null) {
    const res = await this.projectService.addFolder(projectId, name, parentIdReq);
    if (res.success) {
      await this.loadProjectDetails(projectId);
    }
    return res;
  }

  async renameFolder(projectId: string, folderId: string, name: string) {
    const res = await this.projectService.renameFolder(projectId, folderId, name);
    if (res) {
      await this.loadProjectDetails(projectId);
    }
    return res;
  }

  async deleteFolder(projectId: string, folderId: string) {
    const res = await this.projectService.deleteFolder(projectId, folderId);
    if (res) {
      await this.loadProjectDetails(projectId);
    }
    return res;
  }

  async assignSession(projectId: string, sessionId: string, folderId: string | null) {
    const res = await this.projectService.assignSession(projectId, sessionId, folderId);
    if (res) {
      await this.loadProjectDetails(projectId);
      await this.sessionStore.refreshSessions(true);
    }
    return res;
  }
}
