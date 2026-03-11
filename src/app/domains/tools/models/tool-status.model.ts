import type { ToolKind } from './tool-catalog-item.model';

export interface ToolStatus {
  id: string;
  displayName: string;
  description: string;
  kind: ToolKind;
  isInstalled: boolean;
  isInstallable: boolean;
  installedPath: string | null;
  version: string | null;
  reason: string | null;
}
