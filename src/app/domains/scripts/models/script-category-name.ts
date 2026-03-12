import { ScriptCategory } from './script-category.enum';

export function scriptCategoryName(category: ScriptCategory): string {
  switch (category) {
    case ScriptCategory.Recon:
      return 'Recon';
    case ScriptCategory.Web:
      return 'Web';
    case ScriptCategory.Crypto:
      return 'Crypto';
    case ScriptCategory.Pwn:
      return 'Pwn';
    case ScriptCategory.Forensics:
      return 'Forensics';
    case ScriptCategory.Reverse:
      return 'Reverse';
    case ScriptCategory.Misc:
      return 'Misc';
    default:
      return 'Unknown';
  }
}
