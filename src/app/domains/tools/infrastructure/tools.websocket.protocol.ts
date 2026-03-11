import { MessageType } from '../../../infrastructure/transport/websocket/websocket-message-type.enum';
import { bytesToUuid, uuidToBytes } from '../../../infrastructure/transport/websocket/websocket-uuid.utils';
import type { ToolCatalogItem } from '../models/tool-catalog-item.model';
import type { ToolStatus } from '../models/tool-status.model';
import { ToolInstallState } from '../models/tool-install-state.enum';

export interface ToolCatalogSnapshot {
  type: MessageType.ToolCatalogSnapshot;
  tools: ToolCatalogItem[];
}

export interface ToolInstallAccepted {
  type: MessageType.ToolInstallAccepted;
  messageId: string;
  success: boolean;
}

export interface ToolInventoryResult {
  type: MessageType.ToolInventoryResult;
  messageId: string;
  tools: ToolStatus[];
}

export interface ToolInstallProgress {
  type: MessageType.ToolInstallProgress;
  messageId: string;
  toolId: string;
  state: ToolInstallState;
  message: string | null;
  progressPercent: number | null;
  installedPath: string | null;
  error: string | null;
}

export interface ToolOperationError {
  type: MessageType.ToolOperationError;
  messageId: string;
  error: string;
}

export function serializeToolInventoryRequest(messageId: string): Uint8Array {
  const id = uuidToBytes(messageId);
  const buffer = new Uint8Array(1 + 16);

  buffer[0] = MessageType.ToolInventoryRequest;
  buffer.set(id, 1);

  return buffer;
}

export function serializeToolInstallRequest(toolIds: string[], messageId: string): Uint8Array {
  const encoder = new TextEncoder();
  const id = uuidToBytes(messageId);

  const encodedToolIds = toolIds.map((toolId) => encoder.encode(toolId));
  const totalToolIdsSize = encodedToolIds.reduce(
    (sum, bytes) => sum + 4 + bytes.length,
    0,
  );

  const buffer = new Uint8Array(1 + 16 + 4 + totalToolIdsSize);
  const view = new DataView(buffer.buffer);

  let offset = 0;
  view.setUint8(offset, MessageType.ToolInstallRequest);
  offset += 1;

  buffer.set(id, offset);
  offset += 16;

  view.setInt32(offset, toolIds.length, true);
  offset += 4;

  for (const bytes of encodedToolIds) {
    view.setInt32(offset, bytes.length, true);
    offset += 4;

    buffer.set(bytes, offset);
    offset += bytes.length;
  }

  return buffer;
}

export function deserializeToolCatalogSnapshot(
  data: ArrayBuffer | Uint8Array,
): ToolCatalogSnapshot {
  const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
  const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const decoder = new TextDecoder();

  let offset = 0;
  const type = view.getUint8(offset) as MessageType;
  offset += 1;

  if (type !== MessageType.ToolCatalogSnapshot) {
    throw new Error(`Expected ToolCatalogSnapshot but got ${type}`);
  }

  const count = view.getInt32(offset, true);
  offset += 4;

  const readString = () => {
    const length = view.getInt32(offset, true);
    offset += 4;
    const value = decoder.decode(u8.slice(offset, offset + length));
    offset += length;
    return value;
  };

  const readNullableString = () => {
    const hasValue = view.getUint8(offset) === 1;
    offset += 1;
    return hasValue ? readString() : null;
  };

  const tools: ToolCatalogItem[] = [];

  for (let i = 0; i < count; i++) {
    const id = readString();
    const displayName = readString();
    const category = readString();
    const kind = readString() as ToolCatalogItem['kind'];
    const description = readString();
    const commandTemplate = readNullableString();
    const externalUrl = readString() || null;
    const isInstalled = view.getUint8(offset) === 1;
    offset += 1;
    const isInstallable = view.getUint8(offset) === 1;
    offset += 1;
    const installedPath = readString() || null;
    const version = readString() || null;
    const reason = readString() || null;

    tools.push({
      id,
      displayName,
      category,
      kind,
      description,
      commandTemplate,
      externalUrl,
      isInstalled,
      isInstallable,
      installedPath,
      version,
      reason,
    });
  }

  return {
    type: MessageType.ToolCatalogSnapshot,
    tools,
  };
}

export function deserializeToolInventoryResult(
  data: ArrayBuffer | Uint8Array,
): ToolInventoryResult {
  const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
  const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const decoder = new TextDecoder();

  let offset = 0;
  const type = view.getUint8(offset) as MessageType;
  offset += 1;

  if (type !== MessageType.ToolInventoryResult) {
    throw new Error(`Expected ToolInventoryResult but got ${type}`);
  }

  const messageId = bytesToUuid(u8.slice(offset, offset + 16));
  offset += 16;

  const count = view.getInt32(offset, true);
  offset += 4;

  const readString = () => {
    const length = view.getInt32(offset, true);
    offset += 4;
    const value = decoder.decode(u8.slice(offset, offset + length));
    offset += length;
    return value;
  };

  const tools: ToolStatus[] = [];

  for (let i = 0; i < count; i++) {
    const id = readString();
    const displayName = readString();
    const description = readString();
    const kind = readString() as ToolStatus['kind'];
    const isInstalled = view.getUint8(offset) === 1;
    offset += 1;
    const isInstallable = view.getUint8(offset) === 1;
    offset += 1;
    const installedPath = readString() || null;
    const version = readString() || null;
    const reason = readString() || null;

    tools.push({
      id,
      displayName,
      description,
      kind,
      isInstalled,
      isInstallable,
      installedPath,
      version,
      reason,
    });
  }

  return {
    type: MessageType.ToolInventoryResult,
    messageId,
    tools,
  };
}

export function deserializeToolInstallAccepted(
  data: ArrayBuffer | Uint8Array,
): ToolInstallAccepted {
  const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
  const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);

  let offset = 0;
  const type = view.getUint8(offset) as MessageType;
  offset += 1;

  if (type !== MessageType.ToolInstallAccepted) {
    throw new Error(`Expected ToolInstallAccepted but got ${type}`);
  }

  const messageId = bytesToUuid(u8.slice(offset, offset + 16));
  offset += 16;

  const success = view.getUint8(offset) === 1;

  return {
    type: MessageType.ToolInstallAccepted,
    messageId,
    success,
  };
}

export function deserializeToolInstallProgress(
  data: ArrayBuffer | Uint8Array,
): ToolInstallProgress {
  const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
  const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const decoder = new TextDecoder();

  let offset = 0;
  const type = view.getUint8(offset) as MessageType;
  offset += 1;

  if (type !== MessageType.ToolInstallProgress) {
    throw new Error(`Expected ToolInstallProgress but got ${type}`);
  }

  const messageId = bytesToUuid(u8.slice(offset, offset + 16));
  offset += 16;

  const readString = () => {
    const length = view.getInt32(offset, true);
    offset += 4;
    const value = decoder.decode(u8.slice(offset, offset + length));
    offset += length;
    return value;
  };

  const toolId = readString();
  const state = view.getInt32(offset, true) as ToolInstallState;
  offset += 4;

  const message = readString() || null;

  const hasProgress = view.getUint8(offset) === 1;
  offset += 1;

  const progressPercent = hasProgress ? view.getFloat64(offset, true) : null;

  if (hasProgress) {
    offset += 8;
  }

  const installedPath = readString() || null;
  const error = readString() || null;

  return {
    type: MessageType.ToolInstallProgress,
    messageId,
    toolId,
    state,
    message,
    progressPercent,
    installedPath,
    error,
  };
}

export function deserializeToolOperationError(
  data: ArrayBuffer | Uint8Array,
): ToolOperationError {
  const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
  const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const decoder = new TextDecoder();

  let offset = 0;
  const type = view.getUint8(offset) as MessageType;
  offset += 1;

  if (type !== MessageType.ToolOperationError) {
    throw new Error(`Expected ToolOperationError but got ${type}`);
  }

  const messageId = bytesToUuid(u8.slice(offset, offset + 16));
  offset += 16;

  const errorLength = view.getInt32(offset, true);
  offset += 4;

  const error = decoder.decode(u8.slice(offset, offset + errorLength));

  return {
    type: MessageType.ToolOperationError,
    messageId,
    error,
  };
}
