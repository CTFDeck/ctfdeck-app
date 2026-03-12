export interface SessionMetadata {
  id: string;
  name: string;
  description: string;
  projectId: string | null;
  createdAt: Date;
  updatedAt: Date;
  historyCount: number;
  targetCount: number;
  folderId: string | null;
}
