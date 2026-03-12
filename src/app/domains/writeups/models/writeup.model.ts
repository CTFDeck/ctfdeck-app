export interface WriteUpMetadata {
  id: string;
  sessionId: string;
  projectId: string | null;
  folderId: string | null;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WriteUpData extends WriteUpMetadata {
  content: string;
}
