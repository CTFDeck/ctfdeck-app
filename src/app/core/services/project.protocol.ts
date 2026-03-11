import { uuidToBytes, bytesToUuid } from '../../infrastructure/transport/websocket/websocket-uuid.utils'
import { MessageType } from '../../infrastructure/transport/websocket/websocket-message-type.enum'

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface ProjectFolderMetadata {
  id: string;
  parentId: string | null;
  name: string;
  isSystem: boolean;
}

export interface ProjectMetadata {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  folderCount: number;
}

export interface ProjectData {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  folders: ProjectFolderMetadata[];
}

export function isProjectResponse(type: number): boolean {
  return type >= MessageType.ProjectCreateResult && type <= MessageType.ProjectOperationError;
}

export function serializeProjectCreate(name: string, description: string, messageId: string): Uint8Array {
  const nameBytes = encoder.encode(name);
  const descBytes = encoder.encode(description);
  const buffer = new Uint8Array(1 + 16 + 4 + nameBytes.length + 4 + descBytes.length);
  const view = new DataView(buffer.buffer);

  let offset = 0;
  buffer[offset] = MessageType.ProjectCreate; offset += 1;
  buffer.set(uuidToBytes(messageId), offset); offset += 16;
  view.setInt32(offset, nameBytes.length, true); offset += 4;
  buffer.set(nameBytes, offset); offset += nameBytes.length;
  view.setInt32(offset, descBytes.length, true); offset += 4;
  buffer.set(descBytes, offset);

  return buffer;
}

export function serializeProjectLoad(projectId: string, messageId: string): Uint8Array {
  const buffer = new Uint8Array(1 + 16 + 16);
  buffer[0] = MessageType.ProjectLoad;
  buffer.set(uuidToBytes(messageId), 1);
  buffer.set(uuidToBytes(projectId), 17);
  return buffer;
}

export function serializeProjectList(offset: number, limit: number, messageId: string): Uint8Array {
  const buffer = new Uint8Array(1 + 16 + 4 + 4);
  const view = new DataView(buffer.buffer);
  buffer[0] = MessageType.ProjectList;
  buffer.set(uuidToBytes(messageId), 1);
  view.setInt32(17, offset, true);
  view.setInt32(21, limit, true);
  return buffer;
}

export function serializeProjectUpdate(projectId: string, name: string, description: string, messageId: string): Uint8Array {
  const nameBytes = encoder.encode(name);
  const descBytes = encoder.encode(description);
  const buffer = new Uint8Array(1 + 16 + 16 + 4 + nameBytes.length + 4 + descBytes.length);
  const view = new DataView(buffer.buffer);

  let offset = 0;
  buffer[offset] = MessageType.ProjectUpdate; offset += 1;
  buffer.set(uuidToBytes(messageId), offset); offset += 16;
  buffer.set(uuidToBytes(projectId), offset); offset += 16;
  view.setInt32(offset, nameBytes.length, true); offset += 4;
  buffer.set(nameBytes, offset); offset += nameBytes.length;
  view.setInt32(offset, descBytes.length, true); offset += 4;
  buffer.set(descBytes, offset);

  return buffer;
}

export function serializeProjectDelete(projectId: string, messageId: string): Uint8Array {
  const buffer = new Uint8Array(1 + 16 + 16);
  buffer[0] = MessageType.ProjectDelete;
  buffer.set(uuidToBytes(messageId), 1);
  buffer.set(uuidToBytes(projectId), 17);
  return buffer;
}

export function serializeProjectAddFolder(projectId: string, name: string, parentId: string | null, messageId: string): Uint8Array {
  const nameBytes = encoder.encode(name);
  const buffer = new Uint8Array(1 + 16 + 16 + 16 + 4 + nameBytes.length);
  const view = new DataView(buffer.buffer);

  let offset = 0;
  buffer[offset] = MessageType.ProjectAddFolder; offset += 1;
  buffer.set(uuidToBytes(messageId), offset); offset += 16;
  buffer.set(uuidToBytes(projectId), offset); offset += 16;
  buffer.set(uuidToBytes(parentId || '00000000-0000-0000-0000-000000000000'), offset); offset += 16;
  view.setInt32(offset, nameBytes.length, true); offset += 4;
  buffer.set(nameBytes, offset);

  return buffer;
}

export function serializeProjectDeleteFolder(projectId: string, folderId: string, messageId: string): Uint8Array {
  const buffer = new Uint8Array(1 + 16 + 16 + 16);
  buffer[0] = MessageType.ProjectDeleteFolder;
  buffer.set(uuidToBytes(messageId), 1);
  buffer.set(uuidToBytes(projectId), 17);
  buffer.set(uuidToBytes(folderId), 33);
  return buffer;
}

export function serializeProjectRenameFolder(projectId: string, folderId: string, name: string, messageId: string): Uint8Array {
  const nameBytes = encoder.encode(name);
  const buffer = new Uint8Array(1 + 16 + 16 + 16 + 4 + nameBytes.length);
  const view = new DataView(buffer.buffer);

  let offset = 0;
  buffer[offset] = MessageType.ProjectRenameFolder; offset += 1;
  buffer.set(uuidToBytes(messageId), offset); offset += 16;
  buffer.set(uuidToBytes(projectId), offset); offset += 16;
  buffer.set(uuidToBytes(folderId), offset); offset += 16;
  view.setInt32(offset, nameBytes.length, true); offset += 4;
  buffer.set(nameBytes, offset);

  return buffer;
}

export function serializeProjectAssignSession(projectId: string, sessionId: string, folderId: string | null, messageId: string): Uint8Array {
  const buffer = new Uint8Array(1 + 16 + 16 + 16 + 16);
  buffer[0] = MessageType.ProjectAssignSession;
  buffer.set(uuidToBytes(messageId), 1);
  buffer.set(uuidToBytes(projectId), 17);
  buffer.set(uuidToBytes(sessionId), 33);
  // If folderId is null, we use a zero UUID to represent root/unassigned
  buffer.set(uuidToBytes(folderId || '00000000-0000-0000-0000-000000000000'), 49);
  return buffer;
}

export function deserializeProjectCreateResult(data: Uint8Array): { messageId: string, success: boolean, projectId: string } {
  const messageId = bytesToUuid(data.subarray(1, 17));
  const success = data[17] === 1;
  const projectId = bytesToUuid(data.subarray(18, 34));
  return { messageId, success, projectId };
}

export function deserializeProjectListResult(data: Uint8Array): { messageId: string, totalCount: number, projects: ProjectMetadata[] } {
  if (data.byteLength < 25) {
    throw new Error(`ProjectListResult too short: ${data.byteLength} bytes`);
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const messageId = bytesToUuid(data.subarray(1, 17));
  const count = view.getInt32(17, true);
  const totalCount = view.getInt32(21, true);
  let offset = 25;
  const projects: ProjectMetadata[] = [];

  for (let i = 0; i < count; i++) {
    const id = bytesToUuid(data.subarray(offset, offset + 16)); offset += 16;
    const nameLen = view.getInt32(offset, true); offset += 4;
    const name = decoder.decode(data.subarray(offset, offset + nameLen)); offset += nameLen;
    const descLen = view.getInt32(offset, true); offset += 4;
    const description = decoder.decode(data.subarray(offset, offset + descLen)); offset += descLen;
    const createdAtTicks = view.getBigInt64(offset, true); offset += 8;
    const updatedAtTicks = view.getBigInt64(offset, true); offset += 8;
    const folderCount = view.getInt32(offset, true); offset += 4;

    projects.push({
      id, name, description,
      createdAt: ticksToDate(createdAtTicks),
      updatedAt: ticksToDate(updatedAtTicks),
      folderCount
    });
  }
  return { messageId, totalCount, projects };
}

export function deserializeProjectLoadResult(data: Uint8Array): { messageId: string, success: boolean, project: ProjectData | null } {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const messageId = bytesToUuid(data.subarray(1, 17));
  const success = data[17] === 1;

  if (!success) return { messageId, success, project: null };

  let offset = 18;
  const id = bytesToUuid(data.subarray(offset, offset + 16)); offset += 16;
  const nameLen = view.getInt32(offset, true); offset += 4;
  const name = decoder.decode(data.subarray(offset, offset + nameLen)); offset += nameLen;
  const descLen = view.getInt32(offset, true); offset += 4;
  const description = decoder.decode(data.subarray(offset, offset + descLen)); offset += descLen;
  const createdAtTicks = view.getBigInt64(offset, true); offset += 8;
  const updatedAtTicks = view.getBigInt64(offset, true); offset += 8;

  const folderCount = view.getInt32(offset, true); offset += 4;
  const folders: ProjectFolderMetadata[] = [];
  for (let i = 0; i < folderCount; i++) {
    const fId = bytesToUuid(data.subarray(offset, offset + 16)); offset += 16;
    const parentIdRaw = bytesToUuid(data.subarray(offset, offset + 16)); offset += 16;
    const parentId = parentIdRaw === '00000000-0000-0000-0000-000000000000' ? null : parentIdRaw;
    const fNameLen = view.getInt32(offset, true); offset += 4;
    const fName = decoder.decode(data.subarray(offset, offset + fNameLen)); offset += fNameLen;
    const isSystem = data[offset] === 1; offset += 1;
    folders.push({ id: fId, parentId, name: fName, isSystem });
  }

  return {
    messageId, success,
    project: { id, name, description, createdAt: ticksToDate(createdAtTicks), updatedAt: ticksToDate(updatedAtTicks), folders }
  };
}

export function deserializeProjectOperationResult(data: Uint8Array): { messageId: string, success: boolean } {
  const messageId = bytesToUuid(data.subarray(1, 17));
  const success = data[17] === 1;
  return { messageId, success };
}

export function deserializeProjectAddFolderResult(data: Uint8Array): { messageId: string, success: boolean, folderId: string } {
  const messageId = bytesToUuid(data.subarray(1, 17));
  const success = data[17] === 1;
  const folderId = bytesToUuid(data.subarray(18, 34));
  return { messageId, success, folderId };
}

export function deserializeProjectOperationError(data: Uint8Array): { messageId: string, error: string } {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const messageId = bytesToUuid(data.subarray(1, 17));
  const errLen = view.getInt32(17, true);
  const error = decoder.decode(data.subarray(21, 21 + errLen));
  return { messageId, error };
}

function ticksToDate(ticks: bigint): Date {
  const epochDiff = BigInt('621355968000000000');
  const ticksPerMs = BigInt(10000);
  const ms = Number((ticks - epochDiff) / ticksPerMs);
  return new Date(ms);
}
