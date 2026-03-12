import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SudoPasswordRequest } from './sudo-password-request.model';

interface PendingSudoPasswordRequest {
  request: SudoPasswordRequest;
  resolve: (password: string | null) => void;
}

@Injectable({ providedIn: 'root' })
export class SudoPasswordModalStore {
  private queue: PendingSudoPasswordRequest[] = [];
  private current?: PendingSudoPasswordRequest;

  private currentSubject = new BehaviorSubject<SudoPasswordRequest | null>(null);
  readonly current$ = this.currentSubject.asObservable();

  requestPassword(messageId: string, prompt: string): Promise<string | null> {
    return new Promise((resolve) => {
      this.queue.push({
        request: { messageId, prompt },
        resolve,
      });
      this.pump();
    });
  }

  submit(password: string): void {
    if (!this.current) {
      return;
    }

    const current = this.current;
    this.current = undefined;
    this.currentSubject.next(null);
    current.resolve(password);
    this.pump();
  }

  cancel(): void {
    if (!this.current) {
      return;
    }

    const current = this.current;
    this.current = undefined;
    this.currentSubject.next(null);
    current.resolve(null);
    this.pump();
  }

  private pump(): void {
    if (this.current) {
      return;
    }

    const next = this.queue.shift();
    if (!next) {
      return;
    }

    this.current = next;
    this.currentSubject.next(next.request);
  }
}
