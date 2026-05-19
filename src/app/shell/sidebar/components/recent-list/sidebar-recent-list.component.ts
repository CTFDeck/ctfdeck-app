import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideFilePlus,
  lucideFileText,
  lucideMessageCircleDashed,
  lucideMessageSquarePlus,
  lucidePencil,
  lucideTrash2,
} from '@ng-icons/lucide';
import { HlmTooltipImports } from '@ctfdeck/helm/tooltip';
import { Observable } from 'rxjs';
import { SessionMetadata } from '../../../../domains/sessions/models/session-metadata.model';
import { SessionStore } from '../../../../domains/sessions/state/session.store';
import { WriteUpMetadata } from '../../../../domains/writeups/models/writeup.model';
import { WriteUpStore } from '../../../../domains/writeups/state/writeup.store';
import { TranslatePipe } from '../../../menubar/translate.pipe';

@Component({
  selector: 'ctf-sidebar-recent-list',
  standalone: true,
  imports: [CommonModule, NgIcon, HlmTooltipImports, TranslatePipe],
  providers: [
    provideIcons({
      lucideMessageSquarePlus,
      lucideMessageCircleDashed,
      lucidePencil,
      lucideTrash2,
      lucideFilePlus,
      lucideFileText,
    }),
  ],
  templateUrl: './sidebar-recent-list.component.html',
  styleUrls: ['./sidebar-recent-list.component.css'],
})
export class SidebarRecentListComponent {
  @Input() search = '';
  @Input() isCollapsed = false;
  @Input() successfullyDroppedId: string | null = null;

  @Output() newChat = new EventEmitter<void>();
  @Output() newWriteUp = new EventEmitter<void>();
  @Output() openChat = new EventEmitter<SessionMetadata>();
  @Output() openWriteUp = new EventEmitter<WriteUpMetadata>();
  @Output() renameChat = new EventEmitter<SessionMetadata>();
  @Output() deleteChat = new EventEmitter<SessionMetadata>();
  @Output() renameWriteUp = new EventEmitter<WriteUpMetadata>();
  @Output() deleteWriteUp = new EventEmitter<WriteUpMetadata>();
  @Output() dragStarted = new EventEmitter<{
    event: DragEvent;
    type: 'session' | 'writeup';
    id: string;
  }>();
  @Output() dragEnded = new EventEmitter<void>();
  @Output() dragOver = new EventEmitter<DragEvent>();
  @Output() dropped = new EventEmitter<{
    event: DragEvent;
    projectId: string;
    folderId: string | null;
  }>();

  private sessionStore = inject(SessionStore);
  private writeUpStore = inject(WriteUpStore);

  sessionsDisplayLimit = signal(5);
  writeUpsDisplayLimit = signal(5);

  sessions$: Observable<SessionMetadata[]>;
  activeSessionId$: Observable<string | null>;
  writeUps$: Observable<WriteUpMetadata[]>;
  activeWriteUpId$: Observable<string | null>;
  totalSessions$: Observable<number>;
  totalWriteUps$: Observable<number>;

  constructor() {
    this.sessions$ = this.sessionStore.unassignedSessions$;
    this.activeSessionId$ = this.sessionStore.activeSessionId$;
    this.writeUps$ = this.writeUpStore.unassignedWriteUps$;
    this.totalSessions$ = this.sessionStore.unassignedTotal$;
    this.totalWriteUps$ = this.writeUpStore.unassignedTotal$;
    this.activeWriteUpId$ = new Observable((subscriber) => {
      this.writeUpStore.activeWriteUp$.subscribe((activeWriteUp) =>
        subscriber.next(activeWriteUp?.id || null),
      );
    });
  }

  onNewChat(): void {
    this.newChat.emit();
  }

  onNewWriteUp(): void {
    this.newWriteUp.emit();
  }

  async loadMoreSessions(): Promise<void> {
    this.sessionsDisplayLimit.update((count) => count + 6);
    this.sessionStore.refreshSessions(
      true,
      ((await this.sessionStore.unassignedSessions$.toPromise()) || []).length,
      12,
      true,
    );
  }

  async loadMoreWriteUps(): Promise<void> {
    this.writeUpsDisplayLimit.update((count) => count + 6);
    this.writeUpStore.refreshAllWriteUps(
      ((await this.writeUpStore.unassignedWriteUps$.toPromise()) || []).length,
      12,
      true,
    );
  }

  filteredChats(sessions: SessionMetadata[]): SessionMetadata[] {
    const term = this.search?.toLowerCase().trim();
    const filtered = term
      ? sessions.filter((session) => session.name.toLowerCase().includes(term))
      : sessions;

    const limit = this.sessionsDisplayLimit();
    if (
      filtered.length < limit &&
      sessions.length < (this.sessionStore.getTotalSessions(true) || 0)
    ) {
      void this.sessionStore.refreshSessions(true, sessions.length, 12, true);
    }
    return filtered.slice(0, limit);
  }

  filteredWriteUps(writeUps: WriteUpMetadata[]): WriteUpMetadata[] {
    const term = this.search?.toLowerCase().trim();
    const filtered = term
      ? writeUps.filter((writeUp) => writeUp.name.toLowerCase().includes(term))
      : writeUps;

    const limit = this.writeUpsDisplayLimit();
    if (
      filtered.length < limit &&
      writeUps.length < (this.writeUpStore.getTotalWriteUps(true) || 0)
    ) {
      void this.writeUpStore.refreshAllWriteUps(writeUps.length, 12, true);
    }
    return filtered.slice(0, limit);
  }

  onDragStart(event: DragEvent, type: 'session' | 'writeup', id: string): void {
    this.dragStarted.emit({ event, type, id });
  }

  onDragEnd(): void {
    this.dragEnded.emit();
  }

  onDragOver(event: DragEvent): void {
    this.dragOver.emit(event);
  }

  onDrop(event: DragEvent): void {
    this.dropped.emit({ event, projectId: '', folderId: null });
  }
}
