import type { SessionHistoryEntry } from './session-history-entry.model';
import type { SessionTarget } from './session-target.model';

export interface SessionData {
  id: string;
  name: string;
  description: string;
  projectId: string | null;
  createdAt: Date;
  updatedAt: Date;
  folderId: string | null;
  history: SessionHistoryEntry[];
  targets: SessionTarget[];
}
