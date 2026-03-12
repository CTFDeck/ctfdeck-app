import { bytesToUuid, uuidToBytes } from '../../../infrastructure/transport/websocket/websocket-uuid.utils';
import { MessageType } from '../../../infrastructure/transport/websocket/websocket-message-type.enum';
import { WriteUpData, WriteUpMetadata } from '../models/writeup.model';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function isWriteUpResponse(type: number): boolean {
  return (
    (type >= MessageType.WriteUpCreateResult && type <= MessageType.WriteUpLoadResult) ||
    type === MessageType.WriteUpMoveResult ||
    type === MessageType.WriteUpOperationError
  );
}

export function serializeWriteUpCreate(sessionId: string, name: string, messageId: string): Uint8Array {
  const nameBytes = encoder.encode(name);
  const buffer = new Uint8Array(1 + 16 + 16 + 4 + nameBytes.length);
  const view = new DataView(buffer.buffer);

  let offset = 0;
  buffer[offset++] = MessageType.WriteUpCreate;
  buffer.set(uuidToBytes(messageId), offset);
  offset += 16;
  buffer.set(uuidToBytes(sessionId), offset);
  offset += 16;
  view.setInt32(offset, nameBytes.length, true);
  offset += 4;
  buffer.set(nameBytes, offset);

  return buffer;
}

export function serializeWriteUpUpdate(
  writeUpId: string,
  name: string,
  content: string,
  messageId: string,
): Uint8Array {
  const nameBytes = encoder.encode(name);
  const contentBytes = encoder.encode(content);
  const buffer = new Uint8Array(1 + 16 + 16 + 4 + nameBytes.length + 4 + contentBytes.length);
  const view = new DataView(buffer.buffer);

  let offset = 0;
  buffer[offset++] = MessageType.WriteUpUpdate;
  buffer.set(uuidToBytes(messageId), offset);
  offset += 16;
  buffer.set(uuidToBytes(writeUpId), offset);
  offset += 16;
  view.setInt32(offset, nameBytes.length, true);
  offset += 4;
  buffer.set(nameBytes, offset);
  offset += nameBytes.length;
  view.setInt32(offset, contentBytes.length, true);
  offset += 4;
  buffer.set(contentBytes, offset);

  return buffer;
}

export function serializeWriteUpDelete(writeUpId: string, messageId: string): Uint8Array {
  const buffer = new Uint8Array(1 + 16 + 16);
  let offset = 0;
  buffer[offset++] = MessageType.WriteUpDelete;
  buffer.set(uuidToBytes(messageId), offset);
  offset += 16;
  buffer.set(uuidToBytes(writeUpId), offset);
  return buffer;
}

export function serializeWriteUpList(
  sessionId: string,
  offset: number,
  limit: number,
  messageId: string,
  unassignedOnly: boolean = false,
): Uint8Array {
  const buffer = new Uint8Array(1 + 16 + 16 + 4 + 4 + 1);
  const view = new DataView(buffer.buffer);
  let idx = 0;
  buffer[idx++] = MessageType.WriteUpList;
  buffer.set(uuidToBytes(messageId), idx);
  idx += 16;
  buffer.set(uuidToBytes(sessionId), idx);
  idx += 16;
  view.setInt32(idx, offset, true);
  idx += 4;
  view.setInt32(idx, limit, true);
  idx += 4;
  buffer[idx] = unassignedOnly ? 1 : 0;
  return buffer;
}

export function serializeWriteUpLoad(writeUpId: string, messageId: string): Uint8Array {
  const buffer = new Uint8Array(1 + 16 + 16);
  let offset = 0;
  buffer[offset++] = MessageType.WriteUpLoad;
  buffer.set(uuidToBytes(messageId), offset);
  offset += 16;
  buffer.set(uuidToBytes(writeUpId), offset);
  return buffer;
}

export function serializeWriteUpMove(
  writeUpId: string,
  projectId: string | null,
  folderId: string | null,
  messageId: string,
): Uint8Array {
  const buffer = new Uint8Array(1 + 16 + 16 + 16 + 16);
  let offset = 0;
  buffer[offset++] = MessageType.WriteUpMove;
  buffer.set(uuidToBytes(messageId), offset);
  offset += 16;
  buffer.set(uuidToBytes(writeUpId), offset);
  offset += 16;
  buffer.set(uuidToBytes(projectId || '00000000-0000-0000-0000-000000000000'), offset);
  offset += 16;
  buffer.set(uuidToBytes(folderId || '00000000-0000-0000-0000-000000000000'), offset);
  return buffer;
}

export function deserializeWriteUpCreateResult(data: Uint8Array): {
  messageId: string;
  success: boolean;
  writeUpId: string;
} {
  const messageId = bytesToUuid(data.subarray(1, 17));
  const success = data[17] === 1;
  const writeUpId = bytesToUuid(data.subarray(18, 34));
  return { messageId, success, writeUpId };
}

export function deserializeWriteUpUpdateResult(data: Uint8Array): {
  messageId: string;
  success: boolean;
} {
  return {
    messageId: bytesToUuid(data.subarray(1, 17)),
    success: data[17] === 1,
  };
}

export function deserializeWriteUpDeleteResult(data: Uint8Array): {
  messageId: string;
  success: boolean;
} {
  return {
    messageId: bytesToUuid(data.subarray(1, 17)),
    success: data[17] === 1,
  };
}

export function deserializeWriteUpMoveResult(data: Uint8Array): {
  messageId: string;
  success: boolean;
} {
  return {
    messageId: bytesToUuid(data.subarray(1, 17)),
    success: data[17] === 1,
  };
}

export function deserializeWriteUpListResult(data: Uint8Array): {
  messageId: string;
  totalCount: number;
  writeUps: WriteUpMetadata[];
} {
  if (data.byteLength < 25) {
    throw new Error(`WriteUpListResult too short: ${data.byteLength} bytes`);
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const messageId = bytesToUuid(data.subarray(1, 17));
  const count = view.getInt32(17, true);
  const totalCount = view.getInt32(21, true);
  let offset = 25;
  const writeUps: WriteUpMetadata[] = [];

  for (let i = 0; i < count; i++) {
    const id = bytesToUuid(data.subarray(offset, offset + 16));
    offset += 16;
    const sessionId = bytesToUuid(data.subarray(offset, offset + 16));
    offset += 16;
    const projectIdRaw = bytesToUuid(data.subarray(offset, offset + 16));
    const projectId = projectIdRaw === '00000000-0000-0000-0000-000000000000' ? null : projectIdRaw;
    offset += 16;
    const folderIdRaw = bytesToUuid(data.subarray(offset, offset + 16));
    const folderId = folderIdRaw === '00000000-0000-0000-0000-000000000000' ? null : folderIdRaw;
    offset += 16;

    const nameLen = view.getInt32(offset, true);
    offset += 4;
    const name = decoder.decode(data.subarray(offset, offset + nameLen));
    offset += nameLen;

    if (offset + 16 > data.byteLength) {
      throw new Error(`WriteUpListResult too short for timestamps at item ${i}, offset=${offset}, length=${data.byteLength}`);
    }

    const createdAtTicks = view.getBigInt64(offset, true);
    offset += 8;
    const updatedAtTicks = view.getBigInt64(offset, true);
    offset += 8;

    writeUps.push({
      id,
      sessionId,
      projectId,
      folderId,
      name,
      createdAt: ticksToDate(createdAtTicks),
      updatedAt: ticksToDate(updatedAtTicks),
    });
  }

  return { messageId, totalCount, writeUps };
}

export function deserializeWriteUpLoadResult(data: Uint8Array): {
  messageId: string;
  success: boolean;
  writeUp: WriteUpData | null;
} {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const messageId = bytesToUuid(data.subarray(1, 17));
  const success = data[17] === 1;

  if (!success) {
    return { messageId, success, writeUp: null };
  }

  let offset = 18;
  const id = bytesToUuid(data.subarray(offset, offset + 16));
  offset += 16;
  const sessionId = bytesToUuid(data.subarray(offset, offset + 16));
  offset += 16;
  const projectIdRaw = bytesToUuid(data.subarray(offset, offset + 16));
  const projectId = projectIdRaw === '00000000-0000-0000-0000-000000000000' ? null : projectIdRaw;
  offset += 16;
  const folderIdRaw = bytesToUuid(data.subarray(offset, offset + 16));
  const folderId = folderIdRaw === '00000000-0000-0000-0000-000000000000' ? null : folderIdRaw;
  offset += 16;

  const nameLen = view.getInt32(offset, true);
  offset += 4;
  const name = decoder.decode(data.subarray(offset, offset + nameLen));
  offset += nameLen;

  const contentLen = view.getInt32(offset, true);
  offset += 4;
  const content = decoder.decode(data.subarray(offset, offset + contentLen));
  offset += contentLen;

  if (offset + 16 > data.byteLength) {
    throw new Error(`WriteUpLoadResult too short for timestamps, offset=${offset}, length=${data.byteLength}`);
  }

  const createdAtTicks = view.getBigInt64(offset, true);
  offset += 8;
  const updatedAtTicks = view.getBigInt64(offset, true);
  offset += 8;

  return {
    messageId,
    success,
    writeUp: {
      id,
      sessionId,
      projectId,
      folderId,
      name,
      content,
      createdAt: ticksToDate(createdAtTicks),
      updatedAt: ticksToDate(updatedAtTicks),
    },
  };
}

export function deserializeWriteUpOperationError(data: Uint8Array): {
  messageId: string;
  error: string;
} {
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
