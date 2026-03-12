export interface ProjectFolderMetadata {
  id: string;
  parentId: string | null;
  name: string;
  isSystem: boolean;
}

export interface ProjectMetadata {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  folderCount: number;
}

export interface ProjectData {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  folders: ProjectFolderMetadata[];
}
