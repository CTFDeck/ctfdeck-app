import type { SessionMetadata } from './session-metadata.model';

export interface SessionListResponse {
  sessions: SessionMetadata[];
  totalCount: number;
}
