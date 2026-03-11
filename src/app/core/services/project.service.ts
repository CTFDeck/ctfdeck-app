import { Injectable, NgZone } from '@angular/core';
import { WebSocketService } from './websocket.service';
import { generateUUID } from './websocket.protocol';
import {
  MessageType,
  ProjectMetadata,
  ProjectData,
  serializeProjectCreate,
  serializeProjectLoad,
  serializeProjectList,
  serializeProjectUpdate,
  serializeProjectDelete,
  serializeProjectAddFolder,
  serializeProjectDeleteFolder,
  serializeProjectRenameFolder,
  serializeProjectAssignSession,
  isProjectResponse,
  deserializeProjectCreateResult,
  deserializeProjectLoadResult,
  deserializeProjectListResult,
  deserializeProjectOperationResult,
  deserializeProjectAddFolderResult,
  deserializeProjectOperationError,
} from './project.protocol';

@Injectable({ providedIn: 'root' })
export class ProjectService {
  private pending = new Map<string, (result: any) => void>();

  constructor(
    private ws: WebSocketService,
    private zone: NgZone,
  ) {
    this.ws.registerHandler(this.handleMessage.bind(this));
  }

  private handleMessage(data: Uint8Array): boolean {
    const type = data[0];
    if (!isProjectResponse(type)) return false;

    let result: any;
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
    } catch (e) {
      console.error(`[ProjectService] Failed to deserialize message type ${type}:`, e);
      return true;
    }

    const callback = this.pending.get(result.messageId);
    if (callback) {
      this.zone.run(() => {
        this.pending.delete(result.messageId);
        callback(result);
      });
    }

    return true;
  }

  create(name: string, description: string): Promise<{ success: boolean; projectId: string }> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeProjectCreate(name, description, messageId);
      this.pending.set(messageId, (result) => {
        if (result.error) reject(new Error(result.error));
        else resolve({ success: result.success, projectId: result.projectId });
      });
      this.ws.sendBinary(buffer);
    });
  }

  load(projectId: string): Promise<{ success: boolean; project: ProjectData | null }> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeProjectLoad(projectId, messageId);
      this.pending.set(messageId, (result) => {
        if (result.error) reject(new Error(result.error));
        else resolve({ success: result.success, project: result.project });
      });
      this.ws.sendBinary(buffer);
    });
  }

  list(): Promise<ProjectMetadata[]> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeProjectList(messageId);
      this.pending.set(messageId, (result) => {
        if (result.error) reject(new Error(result.error));
        else resolve(result.projects);
      });
      this.ws.sendBinary(buffer);
    });
  }

  update(projectId: string, name: string, description: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeProjectUpdate(projectId, name, description, messageId);
      this.pending.set(messageId, (result) => {
        if (result.error) reject(new Error(result.error));
        else resolve(result.success);
      });
      this.ws.sendBinary(buffer);
    });
  }

  delete(projectId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeProjectDelete(projectId, messageId);
      this.pending.set(messageId, (result) => {
        if (result.error) reject(new Error(result.error));
        else resolve(result.success);
      });
      this.ws.sendBinary(buffer);
    });
  }

  addFolder(projectId: string, name: string, parentId: string | null = null): Promise<{ success: boolean; folderId: string }> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeProjectAddFolder(projectId, name, parentId, messageId);
      this.pending.set(messageId, (result) => {
        if (result.error) reject(new Error(result.error));
        else resolve({ success: result.success, folderId: result.folderId });
      });
      try {
        this.ws.sendBinary(buffer);
      } catch (e) {
        this.pending.delete(messageId);
        reject(e);
      }
    });
  }

  deleteFolder(projectId: string, folderId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeProjectDeleteFolder(projectId, folderId, messageId);
      this.pending.set(messageId, (result) => {
        if (result.error) reject(new Error(result.error));
        else resolve(result.success);
      });
      this.ws.sendBinary(buffer);
    });
  }

  renameFolder(projectId: string, folderId: string, name: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeProjectRenameFolder(projectId, folderId, name, messageId);
      this.pending.set(messageId, (result) => {
        if (result.error) reject(new Error(result.error));
        else resolve(result.success);
      });
      this.ws.sendBinary(buffer);
    });
  }

  assignSession(projectId: string, sessionId: string, folderId: string | null): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeProjectAssignSession(projectId, sessionId, folderId, messageId);
      this.pending.set(messageId, (result) => {
        if (result.error) reject(new Error(result.error));
        else resolve(result.success);
      });
      this.ws.sendBinary(buffer);
    });
  }
}
