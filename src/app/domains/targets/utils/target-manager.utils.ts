import { TargetType } from '../../sessions/models/target-type.enum';
import type { SessionTarget } from '../../sessions/models/session-target.model';
import type { AddTargetForm, EditTargetForm } from '../models/target-form.model';
import type { TargetTypeOption } from '../models/target-type-option.model';

export function createEmptyAddTargetForm(activeSessionId?: string): AddTargetForm {
  return {
    name: '',
    address: '',
    port: undefined,
    description: '',
    type: TargetType.Unknown,
    sessionIds: activeSessionId ? [activeSessionId] : [],
  };
}

export function createEditTargetForm(
  target: SessionTarget,
  activeSessionId: string,
): EditTargetForm {
  return {
    id: target.id,
    name: target.name,
    address: target.address,
    port: target.port ?? undefined,
    description: target.description || '',
    type: target.type,
    sessionId: activeSessionId,
  };
}

export function createTargetTypeOptions(): TargetTypeOption[] {
  return [
    { label: 'Unknown', value: TargetType.Unknown },
    { label: 'Web', value: TargetType.Web },
    { label: 'Pwn', value: TargetType.Pwn },
    { label: 'Crypto', value: TargetType.Crypto },
    { label: 'Forensics', value: TargetType.Forensics },
    { label: 'Reverse', value: TargetType.Reverse },
    { label: 'Misc', value: TargetType.Misc },
  ];
}

export function getTargetKey(target: { address: string; port?: number | null }): string {
  return `${target.address}${target.port ? ':' + target.port : ''}`;
}

export function getTargetIcon(type: number): string {
  switch (type) {
    case TargetType.Web:
      return 'lucideGlobe';
    case TargetType.Pwn:
      return 'lucideTerminal';
    case TargetType.Crypto:
      return 'lucideLock';
    case TargetType.Forensics:
      return 'lucideSearch';
    case TargetType.Reverse:
      return 'lucideCpu';
    case TargetType.Misc:
      return 'lucideHash';
    default:
      return 'lucideTarget';
  }
}
