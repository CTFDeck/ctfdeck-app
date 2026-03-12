import { Injectable, NgZone, inject } from '@angular/core';
import { firstValueFrom, filter, timeout, TimeoutError } from 'rxjs';
import { WebSocketService } from '../../../infrastructure/transport/websocket/websocket.service';
import { generateUUID } from '../../../infrastructure/transport/websocket/websocket-uuid.utils';
import { MessageType } from '../../../infrastructure/transport/websocket/websocket-message-type.enum';
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

  private pending = new Map<string, (result: PendingProjectResult) => void>();

  constructor() {
    this.ws.registerHandler(this.handleMessage.bind(this));
  }

  private async sendWhenReady(buffer: Uint8Array): Promise<void> {
    if (!this.ws.isConnected$.value) {
      await firstValueFrom(
        this.ws.isConnected$.pipe(
          filter((connected) => connected),
          timeout(10_000),
        ),
      ).catch((err) => {
        if (err instanceof TimeoutError) {
          throw new Error('WebSocket connection timeout after 10s');
        }
        throw err;
      });
    }

    this.ws.sendBinary(buffer);
  }

  private handleMessage(data: Uint8Array): boolean {
    const type = data[0];
    if (!isProjectResponse(type)) {
      return false;
    }

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

    const callback = this.pending.get(result.messageId);
    if (!callback) {
      return true;
    }

    this.zone.run(() => {
      this.pending.delete(result.messageId);
      callback(result);
    });

    return true;
  }

  create(name: string, description: string): Promise<{ success: boolean; projectId: string }> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeProjectCreate(name, description, messageId);

      this.pending.set(messageId, (result) => {
        if (result.error) {
          reject(new Error(result.error));
          return;
        }

        resolve({
          success: Boolean(result.success),
          projectId: result.projectId ?? '',
        });
      });

      this.sendWhenReady(buffer).catch((error) => {
        this.pending.delete(messageId);
        reject(error);
      });
    });
  }

  load(projectId: string): Promise<{ success: boolean; project: ProjectData | null }> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeProjectLoad(projectId, messageId);

      this.pending.set(messageId, (result) => {
        if (result.error) {
          reject(new Error(result.error));
          return;
        }

        resolve({
          success: Boolean(result.success),
          project: result.project ?? null,
        });
      });

      this.sendWhenReady(buffer).catch((error) => {
        this.pending.delete(messageId);
        reject(error);
      });
    });
  }

  list(
    offset = 0,
    limit = 50,
  ): Promise<{ projects: ProjectMetadata[]; totalCount: number }> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeProjectList(offset, limit, messageId);

      this.pending.set(messageId, (result) => {
        if (result.error) {
          reject(new Error(result.error));
          return;
        }

        resolve({
          projects: result.projects ?? [],
          totalCount: result.totalCount ?? 0,
        });
      });

      this.sendWhenReady(buffer).catch((error) => {
        this.pending.delete(messageId);
        reject(error);
      });
    });
  }

  update(projectId: string, name: string, description: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeProjectUpdate(projectId, name, description, messageId);

      this.pending.set(messageId, (result) => {
        if (result.error) {
          reject(new Error(result.error));
          return;
        }

        resolve(Boolean(result.success));
      });

      this.sendWhenReady(buffer).catch((error) => {
        this.pending.delete(messageId);
        reject(error);
      });
    });
  }

  delete(projectId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeProjectDelete(projectId, messageId);

      this.pending.set(messageId, (result) => {
        if (result.error) {
          reject(new Error(result.error));
          return;
        }

        resolve(Boolean(result.success));
      });

      this.sendWhenReady(buffer).catch((error) => {
        this.pending.delete(messageId);
        reject(error);
      });
    });
  }

  addFolder(
    projectId: string,
    name: string,
    parentId: string | null = null,
  ): Promise<{ success: boolean; folderId: string }> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeProjectAddFolder(projectId, name, parentId, messageId);

      this.pending.set(messageId, (result) => {
        if (result.error) {
          reject(new Error(result.error));
          return;
        }

        resolve({
          success: Boolean(result.success),
          folderId: result.folderId ?? '',
        });
      });

      this.sendWhenReady(buffer).catch((error) => {
        this.pending.delete(messageId);
        reject(error);
      });
    });
  }

  deleteFolder(projectId: string, folderId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeProjectDeleteFolder(projectId, folderId, messageId);

      this.pending.set(messageId, (result) => {
        if (result.error) {
          reject(new Error(result.error));
          return;
        }

        resolve(Boolean(result.success));
      });

      this.sendWhenReady(buffer).catch((error) => {
        this.pending.delete(messageId);
        reject(error);
      });
    });
  }

  renameFolder(projectId: string, folderId: string, name: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeProjectRenameFolder(projectId, folderId, name, messageId);

      this.pending.set(messageId, (result) => {
        if (result.error) {
          reject(new Error(result.error));
          return;
        }

        resolve(Boolean(result.success));
      });

      this.sendWhenReady(buffer).catch((error) => {
        this.pending.delete(messageId);
        reject(error);
      });
    });
  }

  assignSession(projectId: string, sessionId: string, folderId: string | null): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeProjectAssignSession(projectId, sessionId, folderId, messageId);

      this.pending.set(messageId, (result) => {
        if (result.error) {
          reject(new Error(result.error));
          return;
        }

        resolve(Boolean(result.success));
      });

      this.sendWhenReady(buffer).catch((error) => {
        this.pending.delete(messageId);
        reject(error);
      });
    });
  }
}
