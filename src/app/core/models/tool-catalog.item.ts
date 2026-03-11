export type ToolKind = 'binary' | 'externalWebApp';

export interface ToolCatalogItem {
  id: string;
  displayName: string;
  category: string;
  kind: ToolKind;
  description: string;
  externalUrl: string | null;
  isInstalled: boolean;
  isInstallable: boolean;
  installedPath: string | null;
  version: string | null;
  reason: string | null;
}
