import type { ToolInstallProgress } from '../../models/tool-install-progress.model';
import { ToolInstallState } from '../../models/tool-install-state.enum';
import type { ToolStatus } from '../../models/tool-status.model';

export const TOOL_INSTALL_DISMISSED_STORAGE_KEY = 'ctfdeck_tool_install_dismissed';

export function isToolSelectable(tool: ToolStatus): boolean {
  return !tool.isInstalled && tool.isInstallable;
}

export function hasMissingInstallableTools(tools: ToolStatus[]): boolean {
  return tools.some((tool) => tool.kind === 'binary' && !tool.isInstalled && tool.isInstallable);
}

export function getInstallableVisibleTools(
  tools: ToolStatus[],
  visibleToolIds: Set<string>,
): ToolStatus[] {
  return tools.filter((tool) => tool.kind === 'binary' && visibleToolIds.has(tool.id));
}

export function buildVisibleToolIds(tools: ToolStatus[]): Set<string> {
  return new Set(
    tools.filter((tool) => tool.kind === 'binary' && !tool.isInstalled).map((tool) => tool.id),
  );
}

export function computeInstallingState(
  progressByToolId: Record<string, ToolInstallProgress>,
): boolean {
  return Object.values(progressByToolId).some(
    (progress) =>
      progress.state !== ToolInstallState.Success && progress.state !== ToolInstallState.Failed,
  );
}

export function getToolInstallStateLabel(state: ToolInstallState): string {
  switch (state) {
    case ToolInstallState.Pending:
      return 'Pending';
    case ToolInstallState.Downloading:
      return 'Downloading';
    case ToolInstallState.Extracting:
      return 'Extracting';
    case ToolInstallState.Installing:
      return 'Installing';
    case ToolInstallState.Verifying:
      return 'Verifying';
    case ToolInstallState.Success:
      return 'Success';
    case ToolInstallState.Failed:
      return 'Failed';
    default:
      return 'Unknown';
  }
}
