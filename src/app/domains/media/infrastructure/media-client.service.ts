import { Injectable, NgZone, inject } from '@angular/core';
import { WebSocketService } from '../../../infrastructure/transport/websocket/websocket.service';
import { MessageType } from '../../../infrastructure/transport/websocket/websocket-message-type.enum';
import { bytesToUuid, generateUUID } from '../../../infrastructure/transport/websocket/websocket-uuid.utils';
import {
  PendingMap,
  createWebSocketRequest,
  resolvePendingWebSocketResult,
} from '../../../infrastructure/transport/websocket/websocket-clients.utils';
import { MediaData, MediaMetadata } from '../models/media.model';
import {
  deserializeMediaListResult,
  deserializeMediaLoadResult,
  deserializeMediaOperationError,
  deserializeMediaUploadResult,
  isMediaResponse,
  serializeMediaDelete,
  serializeMediaList,
  serializeMediaLoad,
  serializeMediaUpload,
} from './media.websocket.protocol';

interface PendingMediaResult {
  messageId: string;
  success?: boolean;
  mediaId?: string;
  media?: MediaData | null;
  mediaList?: MediaMetadata[];
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class MediaClientService {
  private ws = inject(WebSocketService);
  private zone = inject(NgZone);

  private pending: PendingMap<PendingMediaResult> = new Map();

  constructor() {
    this.ws.registerHandler(this.handleMessage.bind(this));
  }

  private handleMessage(data: Uint8Array): boolean {
    const type = data[0];
    if (!isMediaResponse(type)) {
      return false;
    }

    try {
      let result: PendingMediaResult;

      switch (type) {
        case MessageType.MediaUploadResult:
          result = deserializeMediaUploadResult(data);
          break;
        case MessageType.MediaLoadResult:
          result = deserializeMediaLoadResult(data);
          break;
        case MessageType.MediaListResult:
          result = deserializeMediaListResult(data);
          break;
        case MessageType.MediaOperationError:
          result = deserializeMediaOperationError(data);
          break;
        default:
          return false;
      }

      resolvePendingWebSocketResult(this.pending, result, this.zone);
    } catch (error) {
      // Media response was addressed to this client type but malformed.
      // Resolve matching pending request with an explicit error to avoid 30s timeout.
      console.error('[MediaClientService] Failed to deserialize media response:', error);

      if (data.length >= 17) {
        try {
          const parsedMessageId = bytesToUuid(data.subarray(1, 17));
          resolvePendingWebSocketResult(this.pending, {
            messageId: parsedMessageId,
            error: `Malformed media response (type ${type})`,
          }, this.zone);
        } catch {
          // Ignore messageId extraction failures.
        }
      }
    }

    return true;
  }

  upload(
    fileName: string,
    mimeType: string,
    fileData: Uint8Array,
  ): Promise<{ success: boolean; mediaId: string }> {
    const messageId = generateUUID();
    return createWebSocketRequest(
      this.pending,
      this.ws,
      messageId,
      serializeMediaUpload(fileName, mimeType, fileData, messageId),
      (r) => ({ success: Boolean(r.success), mediaId: r.mediaId ?? '' }),
    );
  }

  load(mediaId: string): Promise<{ success: boolean; media: MediaData | null }> {
    const messageId = generateUUID();
    return createWebSocketRequest(
      this.pending,
      this.ws,
      messageId,
      serializeMediaLoad(mediaId, messageId),
      (r) => ({ success: Boolean(r.success), media: r.media ?? null }),
    );
  }

  delete(mediaId: string): Promise<boolean> {
    const messageId = generateUUID();
    return createWebSocketRequest(
      this.pending,
      this.ws,
      messageId,
      serializeMediaDelete(mediaId, messageId),
      (r) => Boolean(r.success),
    );
  }

  list(): Promise<MediaMetadata[]> {
    const messageId = generateUUID();
    return createWebSocketRequest(
      this.pending,
      this.ws,
      messageId,
      serializeMediaList(messageId),
      (r) => r.mediaList ?? [],
    );
  }

  async uploadFile(file: File): Promise<{ success: boolean; mediaId: string }> {
    const reader = new FileReader();
    const result = await new Promise<ArrayBuffer>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });

    return this.upload(file.name, file.type, new Uint8Array(result));
  }
}
