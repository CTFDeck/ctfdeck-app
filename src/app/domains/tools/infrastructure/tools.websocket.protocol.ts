import { MessageType } from '../../../infrastructure/transport/websocket/websocket-message-type.enum';
import type { ToolCatalogItem } from '../models/tool-catalog-item.model';
import type { ToolInstallProgress } from '../models/tool-install-progress.model';
import { ToolInstallState } from '../models/tool-install-state.enum';
import type { ToolStatus } from '../models/tool-status.model';
import {
  BinaryReader,
  BinaryWriter,
  binarySizeOfString,
  toUint8Array,
} from '../../../infrastructure/transport/websocket/websocket-protocol.utils';

export interface ToolCatalogSnapshot {
  type: MessageType.ToolCatalogSnapshot;
  tools: ToolCatalogItem[];
}

export interface ToolInstallAccepted {
  type: MessageType.ToolInstallAccepted;
  messageId: string;
  success: boolean;
}

export interface ToolUninstallAccepted {
  type: MessageType.ToolUninstallAccepted;
  messageId: string;
  success: boolean;
}

export interface ToolInventoryResult {
  type: MessageType.ToolInventoryResult;
  messageId: string;
  tools: ToolStatus[];
}

export interface ToolOperationError {
  type: MessageType.ToolOperationError;
  messageId: string;
  error: string;
}

export function serializeToolInventoryRequest(messageId: string): Uint8Array {
  return new BinaryWriter(1 + 16)
    .writeByte(MessageType.ToolInventoryRequest)
    .writeUuid(messageId)
    .buffer;
}

export function serializeToolInstallRequest(toolIds: string[], messageId: string): Uint8Array {
  const totalSize = 1 + 16 + 4 + toolIds.reduce((sum, id) => sum + binarySizeOfString(id), 0);
  const writer = new BinaryWriter(totalSize)
    .writeByte(MessageType.ToolInstallRequest)
    .writeUuid(messageId)
    .writeInt32(toolIds.length);

  for (const toolId of toolIds) {
    writer.writeString(toolId);
  }

  return writer.buffer;
}

export function serializeToolUninstallRequest(toolIds: string[], messageId: string): Uint8Array {
  const totalSize = 1 + 16 + 4 + toolIds.reduce((sum, id) => sum + binarySizeOfString(id), 0);
  const writer = new BinaryWriter(totalSize)
    .writeByte(MessageType.ToolUninstallRequest)
    .writeUuid(messageId)
    .writeInt32(toolIds.length);

  for (const toolId of toolIds) {
    writer.writeString(toolId);
  }

  return writer.buffer;
}

export function deserializeToolCatalogSnapshot(data: ArrayBuffer | Uint8Array): ToolCatalogSnapshot {
  const u8 = toUint8Array(data);
  const reader = new BinaryReader(u8, 0);

  const type = reader.readByte() as MessageType;
  if (type !== MessageType.ToolCatalogSnapshot) {
    throw new Error(`Expected ToolCatalogSnapshot but got ${type}`);
  }

  const count = reader.readInt32();
  const tools: ToolCatalogItem[] = [];

  for (let i = 0; i < count; i++) {
    const id = reader.readString();
    const displayName = reader.readString();
    const category = reader.readString();
    const kind = reader.readString() as ToolCatalogItem['kind'];
    const description = reader.readString();
    const commandTemplate = reader.readNullableString();
    const externalUrl = reader.readStringOrNull();
    const isInstalled = reader.readBoolean();
    const isInstallable = reader.readBoolean();
    const installedPath = reader.readStringOrNull();
    const version = reader.readStringOrNull();
    const reason = reader.readStringOrNull();

    tools.push({ id, displayName, category, kind, description, commandTemplate, externalUrl, isInstalled, isInstallable, installedPath, version, reason });
  }

  return { type: MessageType.ToolCatalogSnapshot, tools };
}

export function deserializeToolInventoryResult(data: ArrayBuffer | Uint8Array): ToolInventoryResult {
  const u8 = toUint8Array(data);
  const reader = new BinaryReader(u8, 0);

  const type = reader.readByte() as MessageType;
  if (type !== MessageType.ToolInventoryResult) {
    throw new Error(`Expected ToolInventoryResult but got ${type}`);
  }

  const messageId = reader.readUuid();
  const count = reader.readInt32();
  const tools: ToolStatus[] = [];

  for (let i = 0; i < count; i++) {
    const id = reader.readString();
    const displayName = reader.readString();
    const description = reader.readString();
    const kind = reader.readString() as ToolStatus['kind'];
    const isInstalled = reader.readBoolean();
    const isInstallable = reader.readBoolean();
    const installedPath = reader.readStringOrNull();
    const version = reader.readStringOrNull();
    const reason = reader.readStringOrNull();

    tools.push({ id, displayName, description, kind, isInstalled, isInstallable, installedPath, version, reason });
  }

  return { type: MessageType.ToolInventoryResult, messageId, tools };
}

export function deserializeToolInstallAccepted(data: ArrayBuffer | Uint8Array): ToolInstallAccepted {
  const u8 = toUint8Array(data);
  const reader = new BinaryReader(u8, 0);

  const type = reader.readByte() as MessageType;
  if (type !== MessageType.ToolInstallAccepted) {
    throw new Error(`Expected ToolInstallAccepted but got ${type}`);
  }

  const messageId = reader.readUuid();
  const success = reader.readBoolean();

  return { type: MessageType.ToolInstallAccepted, messageId, success };
}

export function deserializeToolUninstallAccepted(data: ArrayBuffer | Uint8Array): ToolUninstallAccepted {
  const u8 = toUint8Array(data);
  const reader = new BinaryReader(u8, 0);

  const type = reader.readByte() as MessageType;
  if (type !== MessageType.ToolUninstallAccepted) {
    throw new Error(`Expected ToolUninstallAccepted but got ${type}`);
  }

  const messageId = reader.readUuid();
  const success = reader.readBoolean();

  return { type: MessageType.ToolUninstallAccepted, messageId, success };
}

export function deserializeToolInstallProgress(data: ArrayBuffer | Uint8Array): ToolInstallProgress {
  const u8 = toUint8Array(data);
  const reader = new BinaryReader(u8, 0);

  const type = reader.readByte() as MessageType;
  if (type !== MessageType.ToolInstallProgress) {
    throw new Error(`Expected ToolInstallProgress but got ${type}`);
  }

  const messageId = reader.readUuid();
  const toolId = reader.readString();
  const state = reader.readInt32() as ToolInstallState;
  const message = reader.readStringOrNull();
  const hasProgress = reader.readBoolean();
  const progressPercent = hasProgress ? reader.readInt32() / 100 : null;

  const installedPath = reader.readStringOrNull();
  const error = reader.readStringOrNull();

  return { type: MessageType.ToolInstallProgress, messageId, toolId, state, message, progressPercent, installedPath, error };
}

export function deserializeToolOperationError(data: ArrayBuffer | Uint8Array): ToolOperationError {
  const u8 = toUint8Array(data);
  const reader = new BinaryReader(u8, 0);

  const type = reader.readByte() as MessageType;
  if (type !== MessageType.ToolOperationError) {
    throw new Error(`Expected ToolOperationError but got ${type}`);
  }

  const messageId = reader.readUuid();
  const error = reader.readString();

  return { type: MessageType.ToolOperationError, messageId, error };
}
