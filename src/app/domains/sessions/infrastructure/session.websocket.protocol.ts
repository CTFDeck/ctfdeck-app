// session.websocket.protocol.ts
import { MessageType } from '../../../infrastructure/transport/websocket/websocket-message-type.enum';
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
import type { SessionData } from '../models/session-data.model';
import type { SessionHistoryEntry } from '../models/session-history-entry.model';
import type { SessionMetadata } from '../models/session-metadata.model';
import type { SessionTarget } from '../models/session-target.model';

export function isSessionResponse(type: number): boolean {
  return type >= MessageType.SessionCreateResult && type <= MessageType.SessionOperationError;
}

export function serializeSessionCreate(name: string, messageId: string): Uint8Array {
  const w = new BinaryWriter(1 + 16 + binarySizeOfString(name));
  w.writeByte(MessageType.SessionCreate).writeUuid(messageId).writeString(name);
  return w.buffer;
}

export function serializeSessionSetActive(sessionId: string, messageId: string): Uint8Array {
  const w = new BinaryWriter(1 + 16 + 16);
  w.writeByte(MessageType.SessionSetActive).writeUuid(messageId).writeUuid(sessionId);
  return w.buffer;
}

export function serializeSessionLoad(sessionId: string, messageId: string): Uint8Array {
  const w = new BinaryWriter(1 + 16 + 16);
  w.writeByte(MessageType.SessionLoad).writeUuid(messageId).writeUuid(sessionId);
  return w.buffer;
}

export function serializeSessionList(
  offset: number,
  limit: number,
  messageId: string,
  unassignedOnly = false,
): Uint8Array {
  const w = new BinaryWriter(1 + 16 + 4 + 4 + 1);
  w.writeByte(MessageType.SessionList)
    .writeUuid(messageId)
    .writeInt32(offset)
    .writeInt32(limit)
    .writeBoolean(unassignedOnly);
  return w.buffer;
}

export function serializeSessionDelete(sessionId: string, messageId: string): Uint8Array {
  const w = new BinaryWriter(1 + 16 + 16);
  w.writeByte(MessageType.SessionDelete).writeUuid(messageId).writeUuid(sessionId);
  return w.buffer;
}

export function serializeSessionUpdate(
  sessionId: string,
  name: string,
  description: string,
  messageId: string,
): Uint8Array {
  const w = new BinaryWriter(1 + 16 + 16 + binarySizeOfStrings(name, description));
  w.writeByte(MessageType.SessionUpdate)
    .writeUuid(messageId)
    .writeUuid(sessionId)
    .writeString(name)
    .writeString(description);
  return w.buffer;
}

export function serializeSessionAddTarget(
  sessionId: string,
  address: string,
  port: number | null,
  name: string,
  type: number,
  description: string,
  messageId: string,
): Uint8Array {
  const w = new BinaryWriter(
    1 + 16 + 16 + binarySizeOfStrings(address, name, description || '') + 4 + 4,
  );
  w.writeByte(MessageType.SessionAddTarget)
    .writeUuid(messageId)
    .writeUuid(sessionId)
    .writeString(address)
    .writeInt32(port ?? -1)
    .writeString(name)
    .writeString(description || '')
    .writeInt32(type);
  return w.buffer;
}

export function serializeSessionDeleteTarget(
  sessionId: string,
  targetId: string,
  messageId: string,
): Uint8Array {
  const w = new BinaryWriter(1 + 16 + 16 + 16);
  w.writeByte(MessageType.SessionDeleteTarget)
    .writeUuid(messageId)
    .writeUuid(sessionId)
    .writeUuid(targetId);
  return w.buffer;
}

export function serializeSessionEditTarget(
  sessionId: string,
  targetId: string,
  address: string,
  port: number | null,
  name: string,
  type: number,
  description: string,
  messageId: string,
): Uint8Array {
  const w = new BinaryWriter(
    1 + 16 + 16 + 16 + binarySizeOfStrings(address, name, description || '') + 4 + 4,
  );
  w.writeByte(MessageType.SessionEditTarget)
    .writeUuid(messageId)
    .writeUuid(sessionId)
    .writeUuid(targetId)
    .writeString(address)
    .writeInt32(port ?? -1)
    .writeString(name)
    .writeString(description || '')
    .writeInt32(type);
  return w.buffer;
}

export function deserializeSessionCreateResult(data: Uint8Array): {
  messageId: string;
  success: boolean;
  sessionId: string;
} {
  const { messageId, success, entityId: sessionId } = deserializeMessageIdSuccessUuid(data);
  return { messageId, success, sessionId };
}

export function deserializeSessionSetActiveResult(data: Uint8Array): {
  messageId: string;
  success: boolean;
} {
  return deserializeMessageIdSuccess(data);
}

export function deserializeSessionDeleteResult(data: Uint8Array): {
  messageId: string;
  success: boolean;
} {
  return deserializeMessageIdSuccess(data);
}

export function deserializeSessionUpdateResult(data: Uint8Array): {
  messageId: string;
  success: boolean;
} {
  return deserializeMessageIdSuccess(data);
}

export function deserializeSessionAddTargetResult(data: Uint8Array): {
  messageId: string;
  success: boolean;
  targetId: string;
} {
  const { messageId, success, entityId: targetId } = deserializeMessageIdSuccessUuid(data);
  return { messageId, success, targetId };
}

export function deserializeSessionDeleteTargetResult(data: Uint8Array): {
  messageId: string;
  success: boolean;
} {
  return deserializeMessageIdSuccess(data);
}

export function deserializeSessionEditTargetResult(data: Uint8Array): {
  messageId: string;
  success: boolean;
} {
  return deserializeMessageIdSuccess(data);
}

export function deserializeSessionListResult(data: Uint8Array): {
  messageId: string;
  totalCount: number;
  sessions: SessionMetadata[];
} {
  if (data.byteLength < 25)
    throw new Error(`SessionListResult too short: ${data.byteLength} bytes`);

  const reader = new BinaryReader(data, 1);
  const messageId = reader.readUuid();
  const count = reader.readInt32();
  const totalCount = reader.readInt32();

  if (count < 0 || count > 10_000) throw new Error(`SessionListResult invalid count: ${count}`);

  const sessions: SessionMetadata[] = [];

  for (let i = 0; i < count; i++) {
    if (reader.currentOffset + 16 > data.byteLength)
      throw new Error(`SessionListResult truncated at session ${i} (id)`);
    const id = reader.readUuid();

    if (reader.currentOffset + 4 > data.byteLength)
      throw new Error(`SessionListResult truncated at session ${i} (nameLen)`);
    const nameLen = reader.view.getInt32(reader.currentOffset, true);
    if (nameLen < 0 || reader.currentOffset + 4 + nameLen > data.byteLength)
      throw new Error(`SessionListResult invalid nameLen=${nameLen} at session ${i}`);
    const name = reader.readString();

    if (reader.currentOffset + 4 > data.byteLength)
      throw new Error(`SessionListResult truncated at session ${i} (descLen)`);
    const descLen = reader.view.getInt32(reader.currentOffset, true);
    if (descLen < 0 || reader.currentOffset + 4 + descLen > data.byteLength)
      throw new Error(`SessionListResult invalid descLen=${descLen} at session ${i}`);
    const description = reader.readString();

    if (reader.currentOffset + 16 > data.byteLength)
      throw new Error(`SessionListResult truncated at session ${i} (timestamps)`);
    const createdAt = ticksToDate(reader.readBigInt64());
    const updatedAt = ticksToDate(reader.readBigInt64());

    if (reader.currentOffset + 8 > data.byteLength)
      throw new Error(`SessionListResult truncated at session ${i} (counts)`);
    const historyCount = reader.readInt32();
    const targetCount = reader.readInt32();

    const projectId = reader.readNullableUuid();
    const folderId = reader.readNullableUuid();

    sessions.push({
      id,
      name,
      description,
      projectId,
      folderId,
      createdAt,
      updatedAt,
      historyCount,
      targetCount,
    });
  }

  return { messageId, totalCount, sessions };
}

export function deserializeSessionLoadResult(data: Uint8Array): {
  messageId: string;
  success: boolean;
  session: SessionData | null;
} {
  const { reader, messageId, success } = beginSuccessPayloadReader(data);
  if (!success) return { messageId, success, session: null };

  const id = reader.readUuid();
  const name = reader.readString();
  const description = reader.readString();
  const createdAt = ticksToDate(reader.readBigInt64());
  const updatedAt = ticksToDate(reader.readBigInt64());

  const historyCount = reader.readInt32();
  const targetCount = reader.readInt32();
  const projectId = reader.readNullableUuid();
  const folderId = reader.readNullableUuid();

  const history: SessionHistoryEntry[] = [];

  for (let i = 0; i < historyCount; i++) {
    const entryId = reader.readUuid();
    const timestamp = ticksToDate(reader.readBigInt64());
    const workingDirectory = reader.readString();
    const command = reader.readString();
    const output = reader.readString();
    const exitCode = reader.readInt32();
    history.push({ id: entryId, timestamp, workingDirectory, command, output, exitCode });
  }

  const targets: SessionTarget[] = [];

  for (let i = 0; i < targetCount; i++) {
    const targetId = reader.readUuid();
    const address = reader.readString();
    const portRaw = reader.readInt32();
    const targetName = reader.readString();
    const targetDescription = reader.readString();
    const type = reader.readInt32();
    targets.push({
      id: targetId,
      address,
      port: portRaw === -1 ? null : portRaw,
      name: targetName,
      description: targetDescription,
      type,
    });
  }

  return {
    messageId,
    success,
    session: { id, name, description, projectId, folderId, createdAt, updatedAt, history, targets },
  };
}

export function deserializeSessionOperationError(data: Uint8Array): {
  messageId: string;
  error: string;
} {
  return deserializeMessageIdError(data);
}
