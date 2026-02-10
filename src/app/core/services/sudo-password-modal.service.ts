import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface SudoPasswordRequestVM {
  messageId: string;
  prompt: string;
}

type Pending = {
  req: SudoPasswordRequestVM;
  resolve: (pwd: string | null) => void;
};

@Injectable({ providedIn: 'root' })
export class SudoPasswordModalService {
  private queue: Pending[] = [];
  private current?: Pending;

  private currentSubject = new BehaviorSubject<SudoPasswordRequestVM | null>(null);
  current$ = this.currentSubject.asObservable();

  requestPassword(messageId: string, prompt: string): Promise<string | null> {
    return new Promise((resolve) => {
      this.queue.push({ req: { messageId, prompt }, resolve });
      this.pump();
    });
  }

  submit(password: string) {
    if (!this.current) return;
    const cur = this.current;
    this.current = undefined;
    this.currentSubject.next(null);
    cur.resolve(password);
    this.pump();
  }

  cancel() {
    if (!this.current) return;
    const cur = this.current;
    this.current = undefined;
    this.currentSubject.next(null);
    cur.resolve(null);
    this.pump();
  }

  private pump() {
    if (this.current) return;
    const next = this.queue.shift();
    if (!next) return;
    this.current = next;
    this.currentSubject.next(next.req);
  }
}
