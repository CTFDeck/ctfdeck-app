import { MessageType } from '../../../infrastructure/transport/websocket/websocket-message-type.enum';
import { ProjectData, ProjectFolderMetadata, ProjectMetadata } from '../models/project.model';
import {
  BinaryReader,
  BinaryWriter,
  binarySizeOfString,
  binarySizeOfStrings,
  deserializeMessageIdError,
  deserializeMessageIdSuccess,
  deserializeMessageIdSuccessUuid,
  ticksToDate,
  beginSuccessPayloadReader,
} from '../../../infrastructure/transport/websocket/websocket-protocol.utils';

export function isProjectResponse(type: number): boolean {
  return type >= MessageType.ProjectCreateResult && type <= MessageType.ProjectOperationError;
}

export function serializeProjectCreate(name: string, description: string, messageId: string): Uint8Array {
  return new BinaryWriter(1 + 16 + binarySizeOfStrings(name, description))
    .writeByte(MessageType.ProjectCreate)
    .writeUuid(messageId)
    .writeString(name)
    .writeString(description)
    .buffer;
}

export function serializeProjectLoad(projectId: string, messageId: string): Uint8Array {
  return new BinaryWriter(1 + 16 + 16)
    .writeByte(MessageType.ProjectLoad)
    .writeUuid(messageId)
    .writeUuid(projectId)
    .buffer;
}

export function serializeProjectList(offset: number, limit: number, messageId: string): Uint8Array {
  return new BinaryWriter(1 + 16 + 4 + 4)
    .writeByte(MessageType.ProjectList)
    .writeUuid(messageId)
    .writeInt32(offset)
    .writeInt32(limit)
    .buffer;
}

export function serializeProjectUpdate(projectId: string, name: string, description: string, messageId: string): Uint8Array {
  return new BinaryWriter(1 + 16 + 16 + binarySizeOfStrings(name, description))
    .writeByte(MessageType.ProjectUpdate)
    .writeUuid(messageId)
    .writeUuid(projectId)
    .writeString(name)
    .writeString(description)
    .buffer;
}

export function serializeProjectDelete(projectId: string, messageId: string): Uint8Array {
  return new BinaryWriter(1 + 16 + 16)
    .writeByte(MessageType.ProjectDelete)
    .writeUuid(messageId)
    .writeUuid(projectId)
    .buffer;
}

export function serializeProjectAddFolder(projectId: string, name: string, parentId: string | null, messageId: string): Uint8Array {
  return new BinaryWriter(1 + 16 + 16 + 16 + binarySizeOfString(name))
    .writeByte(MessageType.ProjectAddFolder)
    .writeUuid(messageId)
    .writeUuid(projectId)
    .writeNullableUuid(parentId)
    .writeString(name)
    .buffer;
}

export function serializeProjectDeleteFolder(projectId: string, folderId: string, messageId: string): Uint8Array {
  return new BinaryWriter(1 + 16 + 16 + 16)
    .writeByte(MessageType.ProjectDeleteFolder)
    .writeUuid(messageId)
    .writeUuid(projectId)
    .writeUuid(folderId)
    .buffer;
}

export function serializeProjectRenameFolder(projectId: string, folderId: string, name: string, messageId: string): Uint8Array {
  return new BinaryWriter(1 + 16 + 16 + 16 + binarySizeOfString(name))
    .writeByte(MessageType.ProjectRenameFolder)
    .writeUuid(messageId)
    .writeUuid(projectId)
    .writeUuid(folderId)
    .writeString(name)
    .buffer;
}

export function serializeProjectAssignSession(projectId: string, sessionId: string, folderId: string | null, messageId: string): Uint8Array {
  return new BinaryWriter(1 + 16 + 16 + 16 + 16)
    .writeByte(MessageType.ProjectAssignSession)
    .writeUuid(messageId)
    .writeUuid(projectId)
    .writeUuid(sessionId)
    .writeNullableUuid(folderId)
    .buffer;
}

export function deserializeProjectCreateResult(data: Uint8Array): {
  messageId: string;
  success: boolean;
  projectId: string;
} {
  const { messageId, success, entityId: projectId } = deserializeMessageIdSuccessUuid(data);
  return { messageId, success, projectId };
}

export function deserializeProjectListResult(data: Uint8Array): {
  messageId: string;
  totalCount: number;
  projects: ProjectMetadata[];
} {
  if (data.byteLength < 25) {
    throw new Error(`ProjectListResult too short: ${data.byteLength} bytes`);
  }

  const reader = new BinaryReader(data, 1);
  const messageId = reader.readUuid();
  const count = reader.readInt32();
  const totalCount = reader.readInt32();
  const projects: ProjectMetadata[] = [];

  for (let i = 0; i < count; i++) {
    const id = reader.readUuid();
    const name = reader.readString();
    const description = reader.readString();
    const createdAt = ticksToDate(reader.readBigInt64());
    const updatedAt = ticksToDate(reader.readBigInt64());
    const folderCount = reader.readInt32();
    projects.push({ id, name, description, createdAt, updatedAt, folderCount });
  }

  return { messageId, totalCount, projects };
}

export function deserializeProjectLoadResult(data: Uint8Array): {
  messageId: string;
  success: boolean;
  project: ProjectData | null;
} {
  const { reader, messageId, success } = beginSuccessPayloadReader(data);
  if (!success) return { messageId, success, project: null };

  const id = reader.readUuid();
  const name = reader.readString();
  const description = reader.readString();
  const createdAt = ticksToDate(reader.readBigInt64());
  const updatedAt = ticksToDate(reader.readBigInt64());

  const folderCount = reader.readInt32();
  const folders: ProjectFolderMetadata[] = [];

  for (let i = 0; i < folderCount; i++) {
    const folderId = reader.readUuid();
    const parentId = reader.readNullableUuid();
    const folderName = reader.readString();
    const isSystem = reader.readBoolean();
    folders.push({ id: folderId, parentId, name: folderName, isSystem });
  }

  return { messageId, success, project: { id, name, description, createdAt, updatedAt, folders } };
}

export function deserializeProjectOperationResult(data: Uint8Array): {
  messageId: string;
  success: boolean;
} {
  return deserializeMessageIdSuccess(data);
}

export function deserializeProjectAddFolderResult(data: Uint8Array): {
  messageId: string;
  success: boolean;
  folderId: string;
} {
  const { messageId, success, entityId: folderId } = deserializeMessageIdSuccessUuid(data);
  return { messageId, success, folderId };
}

export function deserializeProjectOperationError(data: Uint8Array): {
  messageId: string;
  error: string;
} {
  return deserializeMessageIdError(data);
}
