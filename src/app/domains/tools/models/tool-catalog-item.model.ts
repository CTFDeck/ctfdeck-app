import type { ToolKind } from './tool-kind.type';

export interface ToolCatalogItem {
  id: string;
  displayName: string;
  category: string;
  kind: ToolKind;
  description: string;
  commandTemplate: string | null;
  externalUrl: string | null;
  isInstalled: boolean;
  isInstallable: boolean;
  installedPath: string | null;
  version: string | null;
  reason: string | null;
}
