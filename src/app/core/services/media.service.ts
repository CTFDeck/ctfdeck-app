import { Injectable, NgZone } from '@angular/core';
import { WebSocketService } from './websocket.service';
import { generateUUID, MessageType } from './websocket.protocol';
import {
  MediaMetadata,
  MediaData,
  isMediaResponse,
  serializeMediaUpload,
  serializeMediaLoad,
  serializeMediaDelete,
  serializeMediaList,
  deserializeMediaUploadResult,
  deserializeMediaLoadResult,
  deserializeMediaListResult,
  deserializeMediaOperationError,
} from './writeup.protocol';

@Injectable({ providedIn: 'root' })
export class MediaService {
  private pending = new Map<string, (result: any) => void>();

  constructor(
    private ws: WebSocketService,
    private zone: NgZone,
  ) {
    this.ws.registerHandler(this.handleMessage.bind(this));
  }

  private handleMessage(data: Uint8Array): boolean {
    const type = data[0];
    if (!isMediaResponse(type)) return false;

    let result: any;
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
    if (callback) {
      this.zone.run(() => {
        this.pending.delete(result.messageId);
        callback(result);
      });
    }

    return true;
  }

  upload(fileName: string, mimeType: string, fileData: Uint8Array): Promise<{ success: boolean; mediaId: string }> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeMediaUpload(fileName, mimeType, fileData, messageId);

      this.pending.set(messageId, (result) => {
        if (result.error) {
          reject(new Error(result.error));
        } else {
          resolve({ success: result.success, mediaId: result.mediaId });
        }
      });

      this.ws.sendBinary(buffer);
    });
  }

  load(mediaId: string): Promise<{ success: boolean; media: MediaData | null }> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeMediaLoad(mediaId, messageId);

      this.pending.set(messageId, (result) => {
        if (result.error) {
          reject(new Error(result.error));
        } else {
          resolve({ success: result.success, media: result.media });
        }
      });

      this.ws.sendBinary(buffer);
    });
  }

  delete(mediaId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeMediaDelete(mediaId, messageId);

      this.pending.set(messageId, (result) => {
        if (result.error) {
          reject(new Error(result.error));
        } else {
          resolve(result.success);
        }
      });

      this.ws.sendBinary(buffer);
    });
  }

  list(): Promise<MediaMetadata[]> {
    return new Promise((resolve, reject) => {
      const messageId = generateUUID();
      const buffer = serializeMediaList(messageId);

      this.pending.set(messageId, (result) => {
        if (result.error) {
          reject(new Error(result.error));
        } else {
          resolve(result.mediaList);
        }
      });

      this.ws.sendBinary(buffer);
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
