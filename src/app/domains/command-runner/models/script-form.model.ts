import { ScriptCategory } from '../../../core/services/session.protocol';

export interface ScriptForm {
  name: string;
  category: ScriptCategory;
  template: string;
}
