import { bytesToUuid, uuidToBytes, MessageType } from './websocket.protocol';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface WriteUpMetadata {
  id: string;
  sessionId: string;
  folderId: string | null;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WriteUpData extends WriteUpMetadata {
  content: string;
}

export interface MediaMetadata {
  id: string;
  fileName: string;
  mimeType: string;
  createdAt: Date;
}

export interface MediaData extends MediaMetadata {
  data: Uint8Array;
}

export function isWriteUpResponse(type: number): boolean {
  return (
    (type >= MessageType.WriteUpCreateResult && type <= MessageType.WriteUpLoadResult) ||
    type === MessageType.WriteUpMoveResult ||
    type === MessageType.WriteUpOperationError
  );
}

export function isMediaResponse(type: number): boolean {
  return (
    (type >= MessageType.MediaUploadResult && type <= MessageType.MediaListResult) ||
    type === MessageType.MediaOperationError
  );
}

// WriteUp Serialization Utilities

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

export function serializeWriteUpList(sessionId: string, messageId: string): Uint8Array {
  const buffer = new Uint8Array(1 + 16 + 16);
  let offset = 0;
  buffer[offset++] = MessageType.WriteUpList;
  buffer.set(uuidToBytes(messageId), offset);
  offset += 16;
  buffer.set(uuidToBytes(sessionId), offset);
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
  folderId: string | null,
  messageId: string,
): Uint8Array {
  const buffer = new Uint8Array(1 + 16 + 16 + 16);
  let offset = 0;
  buffer[offset++] = MessageType.WriteUpMove;
  buffer.set(uuidToBytes(messageId), offset);
  offset += 16;
  buffer.set(uuidToBytes(writeUpId), offset);
  offset += 16;
  buffer.set(uuidToBytes(folderId || '00000000-0000-0000-0000-000000000000'), offset);
  return buffer;
}

// Media Serialization Utilities

export function serializeMediaUpload(
  fileName: string,
  mimeType: string,
  fileData: Uint8Array,
  messageId: string,
): Uint8Array {
  const fileNameBytes = encoder.encode(fileName);
  const mimeTypeBytes = encoder.encode(mimeType);
  const buffer = new Uint8Array(
    1 + 16 + 4 + fileNameBytes.length + 4 + mimeTypeBytes.length + 4 + fileData.length,
  );
  const view = new DataView(buffer.buffer);

  let offset = 0;
  buffer[offset++] = MessageType.MediaUpload;
  buffer.set(uuidToBytes(messageId), offset);
  offset += 16;
  view.setInt32(offset, fileNameBytes.length, true);
  offset += 4;
  buffer.set(fileNameBytes, offset);
  offset += fileNameBytes.length;
  view.setInt32(offset, mimeTypeBytes.length, true);
  offset += 4;
  buffer.set(mimeTypeBytes, offset);
  offset += mimeTypeBytes.length;
  view.setInt32(offset, fileData.length, true);
  offset += 4;
  buffer.set(fileData, offset);

  return buffer;
}

export function serializeMediaLoad(mediaId: string, messageId: string): Uint8Array {
  const buffer = new Uint8Array(1 + 16 + 16);
  let offset = 0;
  buffer[offset++] = MessageType.MediaLoad;
  buffer.set(uuidToBytes(messageId), offset);
  offset += 16;
  buffer.set(uuidToBytes(mediaId), offset);
  return buffer;
}

export function serializeMediaDelete(mediaId: string, messageId: string): Uint8Array {
  const buffer = new Uint8Array(1 + 16 + 16);
  let offset = 0;
  buffer[offset++] = MessageType.MediaDelete;
  buffer.set(uuidToBytes(messageId), offset);
  offset += 16;
  buffer.set(uuidToBytes(mediaId), offset);
  return buffer;
}

export function serializeMediaList(messageId: string): Uint8Array {
  const buffer = new Uint8Array(1 + 16);
  let offset = 0;
  buffer[offset++] = MessageType.MediaList;
  buffer.set(uuidToBytes(messageId), offset);
  return buffer;
}

// Deserialization Utilities

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

export function deserializeWriteUpListResult(data: Uint8Array): {
  messageId: string;
  writeUps: WriteUpMetadata[];
} {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const messageId = bytesToUuid(data.subarray(1, 17));
  const count = view.getInt32(17, true);
  let offset = 21;
  const writeUps: WriteUpMetadata[] = [];

  for (let i = 0; i < count; i++) {
    const id = bytesToUuid(data.subarray(offset, offset + 16));
    offset += 16;
    const sessionId = bytesToUuid(data.subarray(offset, offset + 16));
    offset += 16;
    const folderIdRaw = bytesToUuid(data.subarray(offset, offset + 16));
    const folderId = folderIdRaw === '00000000-0000-0000-0000-000000000000' ? null : folderIdRaw;
    offset += 16;

    const nameLen = view.getInt32(offset, true);
    offset += 4;
    const name = decoder.decode(data.subarray(offset, offset + nameLen));
    offset += nameLen;

    const createdAtTicks = view.getBigInt64(offset, true);
    offset += 8;
    const updatedAtTicks = view.getBigInt64(offset, true);
    offset += 8;

    writeUps.push({
      id,
      sessionId,
      folderId,
      name,
      createdAt: ticksToDate(createdAtTicks),
      updatedAt: ticksToDate(updatedAtTicks),
    });
  }

  return { messageId, writeUps };
}

export function deserializeWriteUpLoadResult(data: Uint8Array): {
  messageId: string;
  success: boolean;
  writeUp: WriteUpData | null;
} {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const messageId = bytesToUuid(data.subarray(1, 17));
  const success = data[17] === 1;

  if (!success) return { messageId, success, writeUp: null };

  let offset = 18;
  const id = bytesToUuid(data.subarray(offset, offset + 16));
  offset += 16;
  const sessionId = bytesToUuid(data.subarray(offset, offset + 16));
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

export function deserializeMediaUploadResult(data: Uint8Array): {
  messageId: string;
  success: boolean;
  mediaId: string;
} {
  const messageId = bytesToUuid(data.subarray(1, 17));
  const success = data[17] === 1;
  const mediaId = bytesToUuid(data.subarray(18, 34));
  return { messageId, success, mediaId };
}

export function deserializeMediaLoadResult(data: Uint8Array): {
  messageId: string;
  success: boolean;
  media: MediaData | null;
} {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const messageId = bytesToUuid(data.subarray(1, 17));
  const success = data[17] === 1;

  if (!success) return { messageId, success, media: null };

  let offset = 18;
  const id = bytesToUuid(data.subarray(offset, offset + 16));
  offset += 16;
  const fileNameLen = view.getInt32(offset, true);
  offset += 4;
  const fileName = decoder.decode(data.subarray(offset, offset + fileNameLen));
  offset += fileNameLen;
  const mimeTypeLen = view.getInt32(offset, true);
  offset += 4;
  const mimeType = decoder.decode(data.subarray(offset, offset + mimeTypeLen));
  offset += mimeTypeLen;
  const dataLen = view.getInt32(offset, true);
  offset += 4;
  const mediaData = data.subarray(offset, offset + dataLen);

  // We don't have createdAt in MediaLoad result in the test client's protocol.js
  // But let's check session.protocol.js again.
  // Actually deserializeMediaListResult has createdAt, but deserializeMediaLoadResult doesn't seem to?
  // Let's re-read session.protocol.js line 1417.
  // Oh, it doesn't have it. I'll stick to what's there.

  return {
    messageId,
    success,
    media: { id, fileName, mimeType, data: mediaData, createdAt: new Date() },
  };
}

export function deserializeMediaListResult(data: Uint8Array): {
  messageId: string;
  mediaList: MediaMetadata[];
} {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const messageId = bytesToUuid(data.subarray(1, 17));
  const count = view.getInt32(17, true);
  let offset = 21;
  const mediaList: MediaMetadata[] = [];

  for (let i = 0; i < count; i++) {
    const id = bytesToUuid(data.subarray(offset, offset + 16));
    offset += 16;
    const fileNameLen = view.getInt32(offset, true);
    offset += 4;
    const fileName = decoder.decode(data.subarray(offset, offset + fileNameLen));
    offset += fileNameLen;
    const mimeTypeLen = view.getInt32(offset, true);
    offset += 4;
    const mimeType = decoder.decode(data.subarray(offset, offset + mimeTypeLen));
    offset += mimeTypeLen;
    const createdAtTicks = view.getBigInt64(offset, true);
    offset += 8;

    mediaList.push({ id, fileName, mimeType, createdAt: ticksToDate(createdAtTicks) });
  }

  return { messageId, mediaList };
}

export function deserializeMediaOperationError(data: Uint8Array): {
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
