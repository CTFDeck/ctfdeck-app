import { Injectable, NgZone, inject } from '@angular/core';
import { WebSocketService } from '../../../infrastructure/transport/websocket/websocket.service';
import { generateUUID } from '../../../infrastructure/transport/websocket/websocket-uuid.utils';
import { MessageType } from '../../../infrastructure/transport/websocket/websocket-message-type.enum';
import {
  PendingMap,
  createWebSocketRequest,
  resolvePendingWebSocketResult,
} from '../../../infrastructure/transport/websocket/websocket-clients.utils';
import { ProjectData, ProjectMetadata } from '../models/project.model';
import {
  deserializeProjectAddFolderResult,
  deserializeProjectCreateResult,
  deserializeProjectListResult,
  deserializeProjectLoadResult,
  deserializeProjectOperationError,
  deserializeProjectOperationResult,
  isProjectResponse,
  serializeProjectAddFolder,
  serializeProjectAssignSession,
  serializeProjectCreate,
  serializeProjectDelete,
  serializeProjectDeleteFolder,
  serializeProjectList,
  serializeProjectLoad,
  serializeProjectRenameFolder,
  serializeProjectUpdate,
} from './project.websocket.protocol';

interface PendingProjectResult {
  messageId: string;
  success?: boolean;
  projectId?: string;
  projects?: ProjectMetadata[];
  totalCount?: number;
  project?: ProjectData | null;
  folderId?: string;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class ProjectClientService {
  private ws = inject(WebSocketService);
  private zone = inject(NgZone);

  private pending: PendingMap<PendingProjectResult> = new Map();

  constructor() {
    this.ws.registerHandler(this.handleMessage.bind(this));
  }

  private handleMessage(data: Uint8Array): boolean {
    const type = data[0];
    if (!isProjectResponse(type)) return false;

    let result: PendingProjectResult;

    try {
      switch (type) {
        case MessageType.ProjectCreateResult:
          result = deserializeProjectCreateResult(data);
          break;
        case MessageType.ProjectLoadResult:
          result = deserializeProjectLoadResult(data);
          break;
        case MessageType.ProjectListResult:
          result = deserializeProjectListResult(data);
          break;
        case MessageType.ProjectAddFolderResult:
          result = deserializeProjectAddFolderResult(data);
          break;
        case MessageType.ProjectUpdateResult:
        case MessageType.ProjectDeleteResult:
        case MessageType.ProjectDeleteFolderResult:
        case MessageType.ProjectRenameFolderResult:
        case MessageType.ProjectAssignSessionResult:
          result = deserializeProjectOperationResult(data);
          break;
        case MessageType.ProjectOperationError:
          result = deserializeProjectOperationError(data);
          break;
        default:
          return false;
      }
    } catch (error) {
      console.error(`[ProjectClientService] Failed to deserialize message type ${type}:`, error);
      return true;
    }

    resolvePendingWebSocketResult(this.pending, result, this.zone);
    return true;
  }

  create(name: string, description: string): Promise<{ success: boolean; projectId: string }> {
    const messageId = generateUUID();
    return createWebSocketRequest(
      this.pending, this.ws, messageId,
      serializeProjectCreate(name, description, messageId),
      (r) => ({ success: Boolean(r.success), projectId: r.projectId ?? '' }),
      (e) => { throw e; },
    );
  }

  load(projectId: string): Promise<{ success: boolean; project: ProjectData | null }> {
    const messageId = generateUUID();
    return createWebSocketRequest(
      this.pending, this.ws, messageId,
      serializeProjectLoad(projectId, messageId),
      (r) => ({ success: Boolean(r.success), project: r.project ?? null }),
      (e) => { throw e; },
    );
  }

  list(offset = 0, limit = 50): Promise<{ projects: ProjectMetadata[]; totalCount: number }> {
    const messageId = generateUUID();
    return createWebSocketRequest(
      this.pending, this.ws, messageId,
      serializeProjectList(offset, limit, messageId),
      (r) => ({ projects: r.projects ?? [], totalCount: r.totalCount ?? 0 }),
      (e) => { throw e; },
    );
  }

  update(projectId: string, name: string, description: string): Promise<boolean> {
    const messageId = generateUUID();
    return createWebSocketRequest(
      this.pending, this.ws, messageId,
      serializeProjectUpdate(projectId, name, description, messageId),
      (r) => Boolean(r.success),
      (e) => { throw e; },
    );
  }

  delete(projectId: string): Promise<boolean> {
    const messageId = generateUUID();
    return createWebSocketRequest(
      this.pending, this.ws, messageId,
      serializeProjectDelete(projectId, messageId),
      (r) => Boolean(r.success),
      (e) => { throw e; },
    );
  }

  addFolder(projectId: string, name: string, parentId: string | null = null): Promise<{ success: boolean; folderId: string }> {
    const messageId = generateUUID();
    return createWebSocketRequest(
      this.pending, this.ws, messageId,
      serializeProjectAddFolder(projectId, name, parentId, messageId),
      (r) => ({ success: Boolean(r.success), folderId: r.folderId ?? '' }),
      (e) => { throw e; },
    );
  }

  deleteFolder(projectId: string, folderId: string): Promise<boolean> {
    const messageId = generateUUID();
    return createWebSocketRequest(
      this.pending, this.ws, messageId,
      serializeProjectDeleteFolder(projectId, folderId, messageId),
      (r) => Boolean(r.success),
      (e) => { throw e; },
    );
  }

  renameFolder(projectId: string, folderId: string, name: string): Promise<boolean> {
    const messageId = generateUUID();
    return createWebSocketRequest(
      this.pending, this.ws, messageId,
      serializeProjectRenameFolder(projectId, folderId, name, messageId),
      (r) => Boolean(r.success),
      (e) => { throw e; },
    );
  }

  assignSession(projectId: string, sessionId: string, folderId: string | null): Promise<boolean> {
    const messageId = generateUUID();
    return createWebSocketRequest(
      this.pending, this.ws, messageId,
      serializeProjectAssignSession(projectId, sessionId, folderId, messageId),
      (r) => Boolean(r.success),
      (e) => { throw e; },
    );
  }
}
