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
  sessions: any[];
  writeups: any[];
  folders: FolderHierarchy[];
}
