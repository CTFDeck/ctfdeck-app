import { WriteUpMetadata } from '../../writeups/models/writeup.model';
import { SessionMetadata } from '../../sessions/models/session-metadata.model';

export interface ProjectHierarchy {
  id: string;
  name: string;
  description: string;
  folders: FolderHierarchy[];
}

export interface FolderHierarchy {
  id: string;
  name: string;
  isSystem: boolean;
  sessions: SessionMetadata[];
  writeups: WriteUpMetadata[];
  folders: FolderHierarchy[];
}
