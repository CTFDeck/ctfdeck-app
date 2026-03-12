import {
  bytesToUuid,
  uuidToBytes,
} from '../../../infrastructure/transport/websocket/websocket-uuid.utils';
import { MessageType } from '../../../infrastructure/transport/websocket/websocket-message-type.enum';
import { MediaData, MediaMetadata } from '../models/media.model';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function isMediaResponse(type: number): boolean {
  return (
    (type >= MessageType.MediaUploadResult && type <= MessageType.MediaListResult) ||
    type === MessageType.MediaOperationError
  );
}

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

  if (!success) {
    return { messageId, success, media: null };
  }

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

  return {
    messageId,
    success,
    media: {
      id,
      fileName,
      mimeType,
      data: mediaData,
      createdAt: new Date(),
    },
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

    mediaList.push({
      id,
      fileName,
      mimeType,
      createdAt: ticksToDate(createdAtTicks),
    });
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
