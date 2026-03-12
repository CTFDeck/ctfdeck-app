// media.websocket.protocol.ts
import { MessageType } from '../../../infrastructure/transport/websocket/websocket-message-type.enum';
import { MediaData, MediaMetadata } from '../models/media.model';
import {
  BinaryReader,
  BinaryWriter,
  binarySizeOfString,
  deserializeMessageIdError,
  deserializeMessageIdSuccessUuid,
  ticksToDate,
} from '../../../infrastructure/transport/websocket/websocket-protocol.utils';

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
  return new BinaryWriter(1 + 16 + binarySizeOfString(fileName) + binarySizeOfString(mimeType) + 4 + fileData.length)
    .writeByte(MessageType.MediaUpload)
    .writeUuid(messageId)
    .writeString(fileName)
    .writeString(mimeType)
    .writeBytes(fileData)
    .buffer;
}

export function serializeMediaLoad(mediaId: string, messageId: string): Uint8Array {
  return new BinaryWriter(1 + 16 + 16)
    .writeByte(MessageType.MediaLoad)
    .writeUuid(messageId)
    .writeUuid(mediaId)
    .buffer;
}

export function serializeMediaDelete(mediaId: string, messageId: string): Uint8Array {
  return new BinaryWriter(1 + 16 + 16)
    .writeByte(MessageType.MediaDelete)
    .writeUuid(messageId)
    .writeUuid(mediaId)
    .buffer;
}

export function serializeMediaList(messageId: string): Uint8Array {
  return new BinaryWriter(1 + 16)
    .writeByte(MessageType.MediaList)
    .writeUuid(messageId)
    .buffer;
}

export function deserializeMediaUploadResult(data: Uint8Array): {
  messageId: string;
  success: boolean;
  mediaId: string;
} {
  const { messageId, success, entityId: mediaId } = deserializeMessageIdSuccessUuid(data);
  return { messageId, success, mediaId };
}

export function deserializeMediaLoadResult(data: Uint8Array): {
  messageId: string;
  success: boolean;
  media: MediaData | null;
} {
  const reader = new BinaryReader(data, 1);
  const messageId = reader.readUuid();
  const success = reader.readBoolean();

  if (!success) {
    return { messageId, success, media: null };
  }

  const id = reader.readUuid();
  const fileName = reader.readString();
  const mimeType = reader.readString();
  const dataLen = reader.readInt32();
  const mediaData = data.subarray(reader.currentOffset, reader.currentOffset + dataLen);

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
  const reader = new BinaryReader(data, 1);
  const messageId = reader.readUuid();
  const count = reader.readInt32();
  const mediaList: MediaMetadata[] = [];

  for (let i = 0; i < count; i++) {
    const id = reader.readUuid();
    const fileName = reader.readString();
    const mimeType = reader.readString();
    const createdAt = ticksToDate(reader.readBigInt64());
    mediaList.push({ id, fileName, mimeType, createdAt });
  }

  return { messageId, mediaList };
}

export function deserializeMediaOperationError(data: Uint8Array): {
  messageId: string;
  error: string;
} {
  return deserializeMessageIdError(data);
}
