import type { SessionTarget } from '../../../core/services/session.protocol';
import type { CommandOption } from '../models/command-option.model';
import type { CustomScript } from '../models/custom-script.model';
import type { ToolCatalogItem } from '../../tools/models/tool-catalog-item.model';

export function buildCommandOptions(
  tools: ToolCatalogItem[],
  scripts: CustomScript[],
): CommandOption[] {
  const toolOptions: CommandOption[] = tools.map((tool) => ({
    id: tool.id,
    name: tool.displayName,
    kind: 'tool',
  }));

  const scriptOptions: CommandOption[] = scripts.map((script) => ({
    id: script.id,
    name: script.name,
    kind: 'script',
  }));

  return [...toolOptions, ...scriptOptions];
}

export function buildCommandFromTemplate(
  target: SessionTarget,
  template: string,
): string {
  let command = template;
  command = command.replace(/{host}/g, target.address);

  const port = target.port ?? (command.includes('http') ? 80 : '');
  command = command.replace(/{port}/g, port.toString());

  return command;
}

export function findToolTemplate(
  tools: ToolCatalogItem[],
  selectedToolId: string,
): string | null {
  return tools.find((tool) => tool.id === selectedToolId)?.commandTemplate ?? null;
}

export function findScriptTemplate(
  scripts: CustomScript[],
  selectedScriptId: string,
): string | null {
  return scripts.find((script) => script.id === selectedScriptId)?.template ?? null;
}

export function hasSelectedCommand(
  selectedToolId: string,
  selectedScriptId: string,
): boolean {
  return !!selectedToolId || !!selectedScriptId;
}

export function getSelectedCommandId(
  selectedToolId: string,
  selectedScriptId: string,
): string {
  return selectedToolId || selectedScriptId;
}

export function applyPendingSelection(
  pendingValue: string | null,
  tools: ToolCatalogItem[],
  scripts: CustomScript[],
): { type: 'none' | 'manage-scripts' | 'tool' | 'script'; value?: string } {
  if (!pendingValue) {
    return { type: 'none' };
  }

  if (pendingValue === '__manage_scripts__') {
    return { type: 'manage-scripts' };
  }

  if (tools.some((tool) => tool.id === pendingValue)) {
    return { type: 'tool', value: pendingValue };
  }

  const script = scripts.find((item) => item.id === pendingValue);

  if (script) {
    return { type: 'script', value: script.id };
  }

  return { type: 'none' };
}
