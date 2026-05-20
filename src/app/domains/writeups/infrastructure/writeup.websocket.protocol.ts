import { MessageType } from '../../../infrastructure/transport/websocket/websocket-message-type.enum';
import { WriteUpData, WriteUpMetadata } from '../models/writeup.model';
import {
  BinaryReader,
  BinaryWriter,
  binarySizeOfString,
  binarySizeOfStrings,
  deserializeMessageIdError,
  deserializeMessageIdSuccess,
  deserializeMessageIdSuccessUuid,
  ticksToDate,
} from '../../../infrastructure/transport/websocket/websocket-protocol.utils';

export function isWriteUpResponse(type: number): boolean {
  return (
    (type >= MessageType.WriteUpCreateResult && type <= MessageType.WriteUpLoadResult) ||
    type === MessageType.WriteUpMoveResult ||
    type === MessageType.WriteUpOperationError
  );
}

export function serializeWriteUpCreate(
  sessionId: string,
  name: string,
  messageId: string,
): Uint8Array {
  return new BinaryWriter(1 + 16 + 16 + binarySizeOfString(name))
    .writeByte(MessageType.WriteUpCreate)
    .writeUuid(messageId)
    .writeUuid(sessionId)
    .writeString(name).buffer;
}

export function serializeWriteUpUpdate(
  writeUpId: string,
  name: string,
  content: string,
  messageId: string,
): Uint8Array {
  return new BinaryWriter(1 + 16 + 16 + binarySizeOfStrings(name, content))
    .writeByte(MessageType.WriteUpUpdate)
    .writeUuid(messageId)
    .writeUuid(writeUpId)
    .writeString(name)
    .writeString(content).buffer;
}

export function serializeWriteUpDelete(writeUpId: string, messageId: string): Uint8Array {
  return new BinaryWriter(1 + 16 + 16)
    .writeByte(MessageType.WriteUpDelete)
    .writeUuid(messageId)
    .writeUuid(writeUpId).buffer;
}

export function serializeWriteUpList(
  sessionId: string,
  offset: number,
  limit: number,
  messageId: string,
  unassignedOnly = false,
): Uint8Array {
  return new BinaryWriter(1 + 16 + 16 + 4 + 4 + 1)
    .writeByte(MessageType.WriteUpList)
    .writeUuid(messageId)
    .writeUuid(sessionId)
    .writeInt32(offset)
    .writeInt32(limit)
    .writeBoolean(unassignedOnly).buffer;
}

export function serializeWriteUpLoad(writeUpId: string, messageId: string): Uint8Array {
  return new BinaryWriter(1 + 16 + 16)
    .writeByte(MessageType.WriteUpLoad)
    .writeUuid(messageId)
    .writeUuid(writeUpId).buffer;
}

export function serializeWriteUpMove(
  writeUpId: string,
  projectId: string | null,
  folderId: string | null,
  messageId: string,
): Uint8Array {
  return new BinaryWriter(1 + 16 + 16 + 16 + 16)
    .writeByte(MessageType.WriteUpMove)
    .writeUuid(messageId)
    .writeUuid(writeUpId)
    .writeNullableUuid(projectId)
    .writeNullableUuid(folderId).buffer;
}

export function deserializeWriteUpCreateResult(data: Uint8Array): {
  messageId: string;
  success: boolean;
  writeUpId: string;
} {
  const { messageId, success, entityId: writeUpId } = deserializeMessageIdSuccessUuid(data);
  return { messageId, success, writeUpId };
}

export function deserializeWriteUpUpdateResult(data: Uint8Array): {
  messageId: string;
  success: boolean;
} {
  return deserializeMessageIdSuccess(data);
}

export function deserializeWriteUpDeleteResult(data: Uint8Array): {
  messageId: string;
  success: boolean;
} {
  return deserializeMessageIdSuccess(data);
}

export function deserializeWriteUpMoveResult(data: Uint8Array): {
  messageId: string;
  success: boolean;
} {
  return deserializeMessageIdSuccess(data);
}

export function deserializeWriteUpListResult(data: Uint8Array): {
  messageId: string;
  totalCount: number;
  writeUps: WriteUpMetadata[];
} {
  if (data.byteLength < 25) {
    throw new Error(`WriteUpListResult too short: ${data.byteLength} bytes`);
  }

  const reader = new BinaryReader(data, 1);
  const messageId = reader.readUuid();
  const count = reader.readInt32();
  const totalCount = reader.readInt32();
  const writeUps: WriteUpMetadata[] = [];

  for (let i = 0; i < count; i++) {
    const id = reader.readUuid();
    const sessionId = reader.readUuid();
    const projectId = reader.readNullableUuid();
    const folderId = reader.readNullableUuid();
    const name = reader.readString();

    if (reader.currentOffset + 16 > data.byteLength) {
      throw new Error(
        `WriteUpListResult too short for timestamps at item ${i}, offset=${reader.currentOffset}, length=${data.byteLength}`,
      );
    }

    const createdAt = ticksToDate(reader.readBigInt64());
    const updatedAt = ticksToDate(reader.readBigInt64());

    writeUps.push({ id, sessionId, projectId, folderId, name, createdAt, updatedAt });
  }

  return { messageId, totalCount, writeUps };
}

export function deserializeWriteUpLoadResult(data: Uint8Array): {
  messageId: string;
  success: boolean;
  writeUp: WriteUpData | null;
} {
  const reader = new BinaryReader(data, 1);
  const messageId = reader.readUuid();
  const success = reader.readBoolean();

  if (!success) {
    return { messageId, success, writeUp: null };
  }

  const id = reader.readUuid();
  const sessionId = reader.readUuid();
  const projectId = reader.readNullableUuid();
  const folderId = reader.readNullableUuid();
  const name = reader.readString();

  if (reader.currentOffset + 16 > data.byteLength) {
    throw new Error(
      `WriteUpLoadResult too short for timestamps, offset=${reader.currentOffset}, length=${data.byteLength}`,
    );
  }

  const createdAt = ticksToDate(reader.readBigInt64());
  const updatedAt = ticksToDate(reader.readBigInt64());
  const content = reader.readString();

  return {
    messageId,
    success,
    writeUp: { id, sessionId, projectId, folderId, name, content, createdAt, updatedAt },
  };
}

export function deserializeWriteUpOperationError(data: Uint8Array): {
  messageId: string;
  error: string;
} {
  return deserializeMessageIdError(data);
}
