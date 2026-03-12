import { Injectable, NgZone } from '@angular/core';
import { firstValueFrom, filter, timeout, TimeoutError } from 'rxjs';
import { WebSocketService } from '../../../infrastructure/transport/websocket/websocket.service';
import { MessageType } from '../../../infrastructure/transport/websocket/websocket-message-type.enum';
import { generateUUID } from '../../../infrastructure/transport/websocket/websocket-uuid.utils';
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
  private pending = new Map<string, (result: PendingMediaResult) => void>();

  constructor(
    private ws: WebSocketService,
    private zone: NgZone,
  ) {
    this.ws.registerHandler(this.handleMessage.bind(this));
  }

  private async sendWhenReady(buffer: Uint8Array): Promise<void> {
    if (!this.ws.isConnected$.value) {
      await firstValueFrom(
        this.ws.isConnected$.pipe(
          filter((connected) => connected),
          timeout(10_000),
        ),
      ).catch((err) => {
        if (err instanceof TimeoutError) {
          throw new Error('WebSocket connection timeout after 10s');
        }
        throw err;
      });
    }

    this.ws.sendBinary(buffer);
  }

  private handleMessage(data: Uint8Array): boolean {
    const type = data[0];
    if (!isMediaResponse(type)) {
      return false;
    }

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

    const callback = this.pending.get(result.messageId);
    if (!callback) {
      return true;
    }

    this.zone.run(() => {
      this.pending.delete(result.messageId);
      callback(result);
    });

    return true;
  }

  upload(
    fileName: string,
    mimeType: string,
    fileData: Uint8Array,
  ): Promise<{ success: boolean; mediaId: string }> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeMediaUpload(fileName, mimeType, fileData, messageId);

      this.pending.set(messageId, (result) => {
        if (result.error) {
          reject(new Error(result.error));
          return;
        }

        resolve({
          success: Boolean(result.success),
          mediaId: result.mediaId ?? '',
        });
      });

      this.sendWhenReady(buffer).catch((error) => {
        this.pending.delete(messageId);
        reject(error);
      });
    });
  }

  load(mediaId: string): Promise<{ success: boolean; media: MediaData | null }> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeMediaLoad(mediaId, messageId);

      this.pending.set(messageId, (result) => {
        if (result.error) {
          reject(new Error(result.error));
          return;
        }

        resolve({
          success: Boolean(result.success),
          media: result.media ?? null,
        });
      });

      this.sendWhenReady(buffer).catch((error) => {
        this.pending.delete(messageId);
        reject(error);
      });
    });
  }

  delete(mediaId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeMediaDelete(mediaId, messageId);

      this.pending.set(messageId, (result) => {
        if (result.error) {
          reject(new Error(result.error));
          return;
        }

        resolve(Boolean(result.success));
      });

      this.sendWhenReady(buffer).catch((error) => {
        this.pending.delete(messageId);
        reject(error);
      });
    });
  }

  list(): Promise<MediaMetadata[]> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeMediaList(messageId);

      this.pending.set(messageId, (result) => {
        if (result.error) {
          reject(new Error(result.error));
          return;
        }

        resolve(result.mediaList ?? []);
      });

      this.sendWhenReady(buffer).catch((error) => {
        this.pending.delete(messageId);
        reject(error);
      });
    });
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
