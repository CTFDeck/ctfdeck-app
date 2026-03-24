import { NgZone } from '@angular/core';
import { firstValueFrom, filter, timeout, TimeoutError } from 'rxjs';
import { WebSocketService } from './websocket.service';

export interface PendingWebSocketResult {
  messageId: string;
  error?: string;
}

export type PendingMap<T extends PendingWebSocketResult> = Map<string, (result: T) => void>;

export async function sendWhenWebSocketReady(
  ws: WebSocketService,
  buffer: Uint8Array,
): Promise<void> {
  if (!ws.isConnected$.value) {
    await firstValueFrom(
      ws.isConnected$.pipe(
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

  ws.sendBinary(buffer);
}

export function resolvePendingWebSocketResult<T extends PendingWebSocketResult>(
  pending: PendingMap<T>,
  result: T,
  zone: NgZone,
): void {
  const callback = pending.get(result.messageId);
  if (!callback) {
    return;
  }

  zone.run(() => {
    pending.delete(result.messageId);
    callback(result);
  });
}

export function createWebSocketRequest<T extends PendingWebSocketResult, R>(
  pending: PendingMap<T>,
  ws: WebSocketService,
  messageId: string,
  buffer: Uint8Array,
  resolve: (result: T) => R,
): Promise<R> {
  return new Promise<R>((res, rej) => {
    const requestTimeout = setTimeout(() => {
      if (pending.has(messageId)) {
        pending.delete(messageId);
        rej(new Error('WebSocket request timeout after 30s'));
      }
    }, 30_000);

    pending.set(messageId, (result) => {
      clearTimeout(requestTimeout);
      if (result.error) {
        rej(new Error(result.error));
        return;
      }

      try {
        res(resolve(result));
      } catch (error) {
        rej(error);
      }
    });

    sendWhenWebSocketReady(ws, buffer).catch((error) => {
      clearTimeout(requestTimeout);
      pending.delete(messageId);
      rej(error);
    });
  });
}
