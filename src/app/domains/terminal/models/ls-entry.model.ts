import type { FilePrefix } from './file-prefix.type';

export interface LsEntry {
  prefix: FilePrefix;
  name: string;
  coloredName: string;
}
